from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from api.auth import CurrentUser
from api.routers import uploads
from api.routers.uploads import submit_claim
from refundflow.domain.models import (
    ClaimAggregateItem,
    ClaimDocument,
    ClaimStatus,
    RefundClaim,
    UploadVerificationStatus,
)


class FakeClaimRepository:
    def __init__(self) -> None:
        self.claim = RefundClaim(
            id="claim-1",
            customer_id="customer-1",
            customer_email="customer@example.com",
            order_id="order-1",
            claim_type="damaged_item",
            reason="The item arrived damaged.",
            requested_amount="10.00",
            status=ClaimStatus.UPLOADING,
        )
        document = ClaimDocument(
            id="document-1",
            claim_id=self.claim.id,
            file_name="receipt.pdf",
            content_type="application/pdf",
            size_bytes=100,
            blob_name="customer-1/claim-1/document-1.pdf",
            upload_verification_status=UploadVerificationStatus.VERIFIED,
        )
        self.items = [
            ClaimAggregateItem(
                id="document:document-1",
                claim_id=self.claim.id,
                item_type="document",
                payload=document.model_dump(mode="json"),
            )
        ]

    async def get_claim(self, claim_id: str) -> RefundClaim | None:
        return self.claim if claim_id == self.claim.id else None

    async def list_items(
        self,
        claim_id: str,
        item_type: str | None = None,
    ) -> list[ClaimAggregateItem]:
        return [
            item
            for item in self.items
            if item.claim_id == claim_id
            and (item_type is None or item.item_type == item_type)
        ]

    async def replace_claim(self, claim: RefundClaim) -> RefundClaim:
        self.claim = claim
        return claim


class FakeHttpClient:
    def __init__(self, **kwargs: object) -> None:
        pass

    async def __aenter__(self) -> "FakeHttpClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def post(self, *args: object, **kwargs: object) -> httpx.Response:
        request = httpx.Request("POST", "http://localhost:7071/api/refund-workflows")
        return httpx.Response(
            409,
            text="A different workflow already exists for this claim",
            request=request,
        )


class SuccessfulFakeHttpClient(FakeHttpClient):
    async def post(self, *args: object, **kwargs: object) -> httpx.Response:
        request = httpx.Request("POST", "http://localhost:7071/api/refund-workflows")
        return httpx.Response(
            202,
            json={"id": "refund-workflow:claim-1"},
            request=request,
        )


@pytest.mark.asyncio
async def test_submit_claim_propagates_workflow_conflict(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = FakeClaimRepository()
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )
    monkeypatch.setattr(
        uploads,
        "get_settings",
        lambda: SimpleNamespace(function_base_url="http://localhost:7071/api", function_key=""),
    )
    monkeypatch.setattr(uploads.httpx, "AsyncClient", FakeHttpClient)

    with pytest.raises(HTTPException) as exception:
        await submit_claim("claim-1", user, repository)

    assert exception.value.status_code == 409
    assert exception.value.detail == "A different workflow already exists for this claim"


@pytest.mark.asyncio
async def test_scanning_claim_retries_workflow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = FakeClaimRepository()
    repository.claim.status = ClaimStatus.SCANNING
    repository.claim.workflow_instance_id = "refund-workflow:claim-1"
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )
    monkeypatch.setattr(
        uploads,
        "get_settings",
        lambda: SimpleNamespace(function_base_url="http://localhost:7071/api", function_key=""),
    )
    monkeypatch.setattr(uploads.httpx, "AsyncClient", SuccessfulFakeHttpClient)

    response = await submit_claim("claim-1", user, repository)

    assert response.status == "scanning"
    assert response.workflow_instance_id == "refund-workflow:claim-1"


@pytest.mark.asyncio
async def test_processing_claim_retries_workflow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = FakeClaimRepository()
    repository.claim.status = ClaimStatus.PROCESSING
    repository.claim.workflow_instance_id = "refund-workflow:claim-1"
    user = CurrentUser(
        user_id="customer-1",
        name="Customer",
        email="customer@example.com",
        roles=frozenset({"Customer"}),
    )
    monkeypatch.setattr(
        uploads,
        "get_settings",
        lambda: SimpleNamespace(function_base_url="http://localhost:7071/api", function_key=""),
    )
    monkeypatch.setattr(uploads.httpx, "AsyncClient", SuccessfulFakeHttpClient)

    response = await submit_claim("claim-1", user, repository)

    assert response.status == "scanning"
    assert response.workflow_instance_id == "refund-workflow:claim-1"
