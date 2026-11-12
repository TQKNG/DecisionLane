from __future__ import annotations

from dataclasses import dataclass, field

import pytest

import function_app
from refundflow.domain.models import (
    ClaimAggregateItem,
    ClaimDocument,
    ClaimType,
    EvidenceClassification,
    EvidenceType,
    ExtractedDocument,
    RefundClaim,
    SafetyAnalysis,
    SafetyDecision,
)


@dataclass
class FakeRepository:
    claim: RefundClaim
    document_item: ClaimAggregateItem
    saved_items: list[ClaimAggregateItem] = field(default_factory=list)

    async def get_claim(self, claim_id: str) -> RefundClaim | None:
        return self.claim if self.claim.id == claim_id else None

    async def list_items(self, claim_id: str, item_type: str) -> list[ClaimAggregateItem]:
        if claim_id != self.claim.id or item_type != "document":
            return []
        return [self.document_item]

    async def upsert_item(self, item: ClaimAggregateItem) -> None:
        self.saved_items.append(item)


class FakeEvidenceStorage:
    def __init__(self) -> None:
        self.promoted = False

    async def download_quarantined(self, blob_name: str) -> bytes:
        return b"validated evidence"

    async def promote(self, blob_name: str, content: bytes, content_type: str) -> None:
        self.promoted = True

    async def close(self) -> None:
        return None


class FakeContentSafety:
    def __init__(self, decision: SafetyDecision) -> None:
        self.decision = decision
        self.calls = 0

    async def analyze(self, content: bytes, content_type: str) -> SafetyAnalysis:
        self.calls += 1
        return SafetyAnalysis(decision=self.decision, severities={})

    async def close(self) -> None:
        return None


class FakeContentUnderstanding:
    def __init__(self, classification: EvidenceClassification) -> None:
        self.classification = classification
        self.calls = 0

    async def analyze(self, content: bytes, content_type: str) -> EvidenceClassification:
        self.calls += 1
        return self.classification

    async def close(self) -> None:
        return None


class FakeExtraction:
    def __init__(self) -> None:
        self.calls = 0

    async def extract(
        self,
        document_id: str,
        file_name: str,
        content_type: str,
        content: bytes,
        safety: SafetyAnalysis,
    ) -> ExtractedDocument:
        self.calls += 1
        return ExtractedDocument(
            document_id=document_id,
            file_name=file_name,
            content_type=content_type,
            page_count=1,
            text="Order 1001",
            key_values={"order_id": "order-1001"},
            safety=safety,
        )

    async def close(self) -> None:
        return None


@dataclass
class FakeServices:
    repository: FakeRepository
    evidence_storage: FakeEvidenceStorage
    content_safety: FakeContentSafety
    content_understanding: FakeContentUnderstanding
    extraction: FakeExtraction

    async def close(self) -> None:
        return None


def make_services(decision: SafetyDecision) -> FakeServices:
    document = ClaimDocument(
        id="document-1",
        claim_id="claim-1",
        file_name="receipt.pdf",
        content_type="application/pdf",
        size_bytes=100,
        blob_name="customer-1/claim-1/document-1.pdf",
    )
    claim = RefundClaim(
        id="claim-1",
        customer_id="customer-1",
        customer_email="customer@example.com",
        order_id="order-1001",
        claim_type=ClaimType.DAMAGED_ITEM,
        reason="The item arrived damaged.",
        requested_amount="10.00",
    )
    classification = EvidenceClassification(
        evidence_type=EvidenceType.RECEIPT,
        confidence=0.94,
        image_quality="good",
        reason="The document contains purchase evidence.",
        validation_status="classified",
        analyzer_id="refund_evidence_document_classifier",
    )
    return FakeServices(
        repository=FakeRepository(
            claim=claim,
            document_item=ClaimAggregateItem(
                id="document:document-1",
                claim_id=claim.id,
                item_type="document",
                payload=document.model_dump(mode="json"),
            ),
        ),
        evidence_storage=FakeEvidenceStorage(),
        content_safety=FakeContentSafety(decision),
        content_understanding=FakeContentUnderstanding(classification),
        extraction=FakeExtraction(),
    )


@pytest.mark.asyncio
async def test_process_document_persists_classification_and_extraction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    services = make_services(SafetyDecision.PASS)
    monkeypatch.setattr(function_app, "ActivityServices", lambda: services)

    process_document = function_app.process_document._function._func
    result = await process_document(
        {"claim_id": "claim-1", "document_id": "document-1"}
    )

    saved_types = {item.item_type for item in services.repository.saved_items}
    assert result["decision"] == SafetyDecision.PASS.value
    assert result["promotable"] is False
    assert {"document", "classification", "extraction"}.issubset(saved_types)
    assert services.content_understanding.calls == 1
    assert services.extraction.calls == 1
    assert services.evidence_storage.promoted is False


@pytest.mark.asyncio
async def test_process_document_does_not_classify_blocked_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    services = make_services(SafetyDecision.BLOCK)
    monkeypatch.setattr(function_app, "ActivityServices", lambda: services)

    process_document = function_app.process_document._function._func
    result = await process_document(
        {"claim_id": "claim-1", "document_id": "document-1"}
    )

    assert result == {
        "decision": SafetyDecision.BLOCK.value,
        "document": None,
    }
    assert services.content_understanding.calls == 0
    assert services.extraction.calls == 0
