from dataclasses import dataclass, field

import pytest

import function_app
from refundflow.domain.evidence_validation import (
    EvidenceBundleStatus,
    evaluate_evidence_bundle,
)
from refundflow.domain.models import (
    ClaimAggregateItem,
    ClaimType,
    EvidenceClassification,
    EvidenceType,
    ExtractedDocument,
    RefundClaim,
    SafetyAnalysis,
    SafetyDecision,
)


def make_classification(
    evidence_type: EvidenceType,
    confidence: float = 0.95,
    damage_visible: bool | None = None,
) -> EvidenceClassification:
    return EvidenceClassification(
        evidence_type=evidence_type,
        confidence=confidence,
        image_quality="good",
        damage_visible=damage_visible,
        reason="Synthetic test evidence.",
        validation_status="classified",
        analyzer_id="test-analyzer",
    )


def make_extraction(document_id: str, key_values: dict[str, str]) -> ExtractedDocument:
    return ExtractedDocument(
        document_id=document_id,
        file_name="evidence.pdf",
        content_type="application/pdf",
        page_count=1,
        text="Synthetic test evidence.",
        key_values=key_values,
        safety=SafetyAnalysis(decision=SafetyDecision.PASS, severities={}),
    )


@dataclass
class ValidationRepository:
    claim: RefundClaim
    saved_items: list[ClaimAggregateItem] = field(default_factory=list)

    async def get_claim(self, claim_id: str) -> RefundClaim | None:
        return self.claim if claim_id == self.claim.id else None

    async def upsert_item(self, item: ClaimAggregateItem) -> None:
        self.saved_items.append(item)


@dataclass
class ValidationServices:
    repository: ValidationRepository

    async def close(self) -> None:
        return None


def test_damaged_item_bundle_is_ready_when_all_requirements_pass() -> None:
    result = evaluate_evidence_bundle(
        ClaimType.DAMAGED_ITEM,
        classifications={
            "receipt-1": make_classification(EvidenceType.RECEIPT),
            "damage-1": make_classification(
                EvidenceType.DAMAGE_PHOTO,
                damage_visible=True,
            ),
        },
        extractions={
            "receipt-1": make_extraction(
                "receipt-1",
                {
                    "order_id": "order-1001",
                    "purchase_date": "2026-11-01",
                    "total_amount": "129.99",
                    "currency": "CAD",
                },
            ),
            "damage-1": make_extraction("damage-1", {}),
        },
        safety_decisions={"receipt-1": "pass", "damage-1": "pass"},
    )

    assert result.status == EvidenceBundleStatus.READY
    assert set(result.document_ids) == {"receipt-1", "damage-1"}
    assert result.reasons == ()


def test_missing_required_evidence_needs_information() -> None:
    result = evaluate_evidence_bundle(
        ClaimType.DAMAGED_ITEM,
        classifications={
            "receipt-1": make_classification(EvidenceType.RECEIPT),
        },
        extractions={
            "receipt-1": make_extraction(
                "receipt-1",
                {
                    "order_id": "order-1001",
                    "total_amount": "129.99",
                    "currency": "CAD",
                },
            ),
        },
        safety_decisions={"receipt-1": "pass"},
    )

    assert result.status == EvidenceBundleStatus.NEEDS_INFORMATION
    assert any("visible_damage" in reason for reason in result.reasons)


def test_low_classification_confidence_requires_human_review() -> None:
    result = evaluate_evidence_bundle(
        ClaimType.DAMAGED_ITEM,
        classifications={
            "receipt-1": make_classification(EvidenceType.RECEIPT, confidence=0.70),
            "damage-1": make_classification(
                EvidenceType.DAMAGE_PHOTO,
                damage_visible=True,
            ),
        },
        extractions={
            "receipt-1": make_extraction(
                "receipt-1",
                {
                    "order_id": "order-1001",
                    "purchase_date": "2026-11-01",
                    "total_amount": "129.99",
                    "currency": "CAD",
                },
            ),
            "damage-1": make_extraction("damage-1", {}),
        },
        safety_decisions={"receipt-1": "pass", "damage-1": "pass"},
    )

    assert result.status == EvidenceBundleStatus.HUMAN_REVIEW


def test_blocked_or_safety_review_evidence_does_not_promote() -> None:
    blocked = evaluate_evidence_bundle(
        ClaimType.DAMAGED_ITEM,
        classifications={},
        extractions={},
        safety_decisions={"document-1": "block"},
    )
    review = evaluate_evidence_bundle(
        ClaimType.DAMAGED_ITEM,
        classifications={},
        extractions={},
        safety_decisions={"document-1": "review"},
    )

    assert blocked.status == EvidenceBundleStatus.REJECTED
    assert review.status == EvidenceBundleStatus.HUMAN_REVIEW


@pytest.mark.asyncio
async def test_validation_activity_persists_result(monkeypatch: pytest.MonkeyPatch) -> None:
    claim = RefundClaim(
        id="claim-1",
        customer_id="customer-1",
        customer_email="customer@example.com",
        order_id="order-1001",
        claim_type=ClaimType.DAMAGED_ITEM,
        reason="The item arrived damaged.",
        requested_amount="10.00",
    )
    repository = ValidationRepository(claim=claim)
    monkeypatch.setattr(
        function_app,
        "ActivityServices",
        lambda: ValidationServices(repository=repository),
    )

    validate_activity = function_app.validate_evidence_bundle._function._func
    result = await validate_activity(
        {
            "claim_id": claim.id,
            "classifications": {
                "receipt-1": make_classification(EvidenceType.RECEIPT),
                "damage-1": make_classification(
                    EvidenceType.DAMAGE_PHOTO,
                    damage_visible=True,
                ),
            },
            "extractions": {
                "receipt-1": make_extraction(
                    "receipt-1",
                    {
                        "order_id": "order-1001",
                        "purchase_date": "2026-11-01",
                        "total_amount": "129.99",
                        "currency": "CAD",
                    },
                ).model_dump(mode="json"),
                "damage-1": make_extraction("damage-1", {}).model_dump(mode="json"),
            },
            "safety_decisions": {"receipt-1": "pass", "damage-1": "pass"},
        }
    )

    assert result["status"] == EvidenceBundleStatus.READY.value
    assert repository.saved_items[0].item_type == "evidence_validation"
