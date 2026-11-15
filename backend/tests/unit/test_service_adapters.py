from decimal import Decimal
from types import SimpleNamespace
from typing import Self
from unittest.mock import AsyncMock, Mock, patch

import pytest

from refundflow.services import email, embeddings, evidence_storage, payments
from refundflow.services.email import StatusEmailService
from refundflow.services.embeddings import EmbeddingService
from refundflow.services.evidence_storage import EvidenceStorageService
from refundflow.services.payments import StripeRefundService


def test_status_email_sends_claim_update() -> None:
    poller = Mock()
    client = Mock(begin_send=Mock(return_value=poller))
    with patch.object(email, "EmailClient", return_value=client):
        service = StatusEmailService("endpoint", "sender@example.test", Mock())
        service.send("customer@example.test", "claim-1", "under review")

    message = client.begin_send.call_args.args[0]
    assert message["senderAddress"] == "sender@example.test"
    assert message["recipients"]["to"] == [{"address": "customer@example.test"}]
    assert message["content"]["subject"] == "Refund claim claim-1 update"
    poller.result.assert_called_once()


def test_stripe_refund_rounds_to_minor_units_and_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(payments.stripe, "api_key", None)
    with patch.object(
        payments.stripe.Refund,
        "create",
        return_value=SimpleNamespace(id="refund-1", status="succeeded"),
    ) as create:
        service = StripeRefundService("test-key")
        result = service.create_refund(
            "claim-1",
            "pi-1",
            Decimal("12.345"),
            "CAD",
        )

    assert result == {"refund_id": "refund-1", "status": "succeeded", "amount": 1235}
    create.assert_called_once_with(
        payment_intent="pi-1",
        amount=1235,
        metadata={"claim_id": "claim-1", "currency": "CAD"},
        idempotency_key="refundflow:claim-1",
    )


@pytest.mark.asyncio
async def test_embedding_service_sorts_results_by_input_index() -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "data": [
                    {"index": 1, "embedding": [2.0]},
                    {"index": 0, "embedding": [1.0]},
                ]
            }

    class FakeAsyncClient:
        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *args: object) -> None:
            return None

        async def post(
            self,
            url: str,
            *,
            headers: dict[str, str],
            json: dict[str, list[str]],
        ) -> FakeResponse:
            assert url == (
                "https://ai.example.test/openai/deployments/embed"
                "/embeddings?api-version=2024-10-21"
            )
            assert headers == {"Authorization": "Bearer token"}
            assert json == {"input": ["first", "second"]}
            return FakeResponse()

    credential = SimpleNamespace(
        get_token=AsyncMock(return_value=SimpleNamespace(token="token"))
    )
    with patch.object(embeddings.httpx, "AsyncClient", return_value=FakeAsyncClient()):
        service = EmbeddingService(
            "https://ai.example.test/",
            "embed",
            credential,
        )
        result = await service.embed(["first", "second"])

    assert result == [[1.0], [2.0]]


@pytest.mark.asyncio
async def test_evidence_storage_downloads_promotes_and_closes() -> None:
    downloader = SimpleNamespace(readall=AsyncMock(return_value=b"evidence"))
    quarantine = SimpleNamespace(
        download_blob=AsyncMock(return_value=downloader),
        delete_blob=AsyncMock(),
    )
    evidence = SimpleNamespace(upload_blob=AsyncMock())
    client = SimpleNamespace(
        get_blob_client=Mock(
            side_effect=lambda container, name: (
                evidence if container == "evidence" else quarantine
            )
        ),
        close=AsyncMock(),
    )
    with patch.object(evidence_storage, "BlobServiceClient", return_value=client):
        service = EvidenceStorageService(
            "https://storage.example.test",
            Mock(),
            "quarantine",
            "evidence",
        )
        content = await service.download_quarantined("claim-1/file.pdf")
        await service.promote("claim-1/file.pdf", content, "application/pdf")
        await service.close()

    assert content == b"evidence"
    evidence.upload_blob.assert_awaited_once()
    assert evidence.upload_blob.call_args.args == (content,)
    assert evidence.upload_blob.call_args.kwargs["overwrite"] is False
    assert evidence.upload_blob.call_args.kwargs["content_settings"].content_type == (
        "application/pdf"
    )
    assert client.get_blob_client.call_args_list[1].args == (
        "evidence",
        "claim-1/file.pdf",
    )
    quarantine.delete_blob.assert_awaited_once()
    client.close.assert_awaited_once()


def test_telemetry_configuration_and_trace_id(monkeypatch: pytest.MonkeyPatch) -> None:
    from refundflow import telemetry

    monkeypatch.setenv("ENABLE_INSTRUMENTATION", "true")
    monkeypatch.setenv(
        "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "InstrumentationKey=test-key",
    )
    with patch.object(telemetry, "configure_azure_monitor") as configure:
        logger = telemetry.configure_telemetry()

    configure.assert_called_once_with(
        connection_string="InstrumentationKey=test-key",
        logger_name="refundflow",
        enable_live_metrics=False,
    )
    assert logger.name == "refundflow"
    assert telemetry.get_trace_id() is None


def test_telemetry_can_be_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    from refundflow import telemetry

    monkeypatch.setenv("ENABLE_INSTRUMENTATION", "false")
    with patch.object(telemetry, "configure_azure_monitor") as configure:
        telemetry.configure_telemetry()

    configure.assert_not_called()


def test_telemetry_formats_valid_trace_id() -> None:
    from refundflow import telemetry

    span_context = SimpleNamespace(is_valid=True, trace_id=1)
    span = SimpleNamespace(get_span_context=Mock(return_value=span_context))
    with patch.object(telemetry.trace, "get_current_span", return_value=span):
        assert telemetry.get_trace_id() == "00000000000000000000000000000001"

