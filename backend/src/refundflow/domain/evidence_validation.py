from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from refundflow.domain.models import (
    ClaimType,
    EvidenceClassification,
    EvidenceType,
    ExtractedDocument,
)


class EvidenceBundleStatus(StrEnum):
    READY = "ready"
    NEEDS_INFORMATION = "needs_information"
    HUMAN_REVIEW = "human_review"
    REJECTED = "rejected"


@dataclass(frozen=True)
class EvidenceRequirement:
    name: str
    evidence_types: frozenset[EvidenceType]
    minimum_confidence: float
    required_fields: frozenset[str] = frozenset()


REQUIREMENTS: dict[ClaimType, tuple[EvidenceRequirement, ...]] = {
    ClaimType.DAMAGED_ITEM: (
        EvidenceRequirement(
            name="purchase_evidence",
            evidence_types=frozenset(
                {
                    EvidenceType.RECEIPT,
                    EvidenceType.INVOICE,
                    EvidenceType.ORDER_CONFIRMATION,
                }
            ),
            minimum_confidence=0.80,
            required_fields=frozenset(
                {"order_id", "purchase_date", "total_amount", "currency"}
            ),
        ),
        EvidenceRequirement(
            name="visible_damage",
            evidence_types=frozenset({EvidenceType.DAMAGE_PHOTO}),
            minimum_confidence=0.85,
        ),
    ),
    ClaimType.WRONG_ITEM: (
        EvidenceRequirement(
            name="purchase_evidence",
            evidence_types=frozenset(
                {
                    EvidenceType.RECEIPT,
                    EvidenceType.INVOICE,
                    EvidenceType.ORDER_CONFIRMATION,
                }
            ),
            minimum_confidence=0.80,
            required_fields=frozenset({"order_id", "total_amount"}),
        ),
        EvidenceRequirement(
            name="wrong_item_evidence",
            evidence_types=frozenset(
                {
                    EvidenceType.PRODUCT_PHOTO,
                    EvidenceType.PACKAGE_LABEL,
                }
            ),
            minimum_confidence=0.80,
        ),
    ),
    ClaimType.NON_DELIVERY: (
        EvidenceRequirement(
            name="order_evidence",
            evidence_types=frozenset(
                {
                    EvidenceType.RECEIPT,
                    EvidenceType.INVOICE,
                    EvidenceType.ORDER_CONFIRMATION,
                }
            ),
            minimum_confidence=0.80,
            required_fields=frozenset({"order_id"}),
        ),
        EvidenceRequirement(
            name="tracking_evidence",
            evidence_types=frozenset({EvidenceType.TRACKING_EVIDENCE}),
            minimum_confidence=0.80,
            required_fields=frozenset({"tracking_number", "delivery_status"}),
        ),
    ),
    ClaimType.DELAYED_DELIVERY: (
        EvidenceRequirement(
            name="order_evidence",
            evidence_types=frozenset(
                {
                    EvidenceType.RECEIPT,
                    EvidenceType.INVOICE,
                    EvidenceType.ORDER_CONFIRMATION,
                }
            ),
            minimum_confidence=0.80,
            required_fields=frozenset({"order_id"}),
        ),
        EvidenceRequirement(
            name="tracking_evidence",
            evidence_types=frozenset({EvidenceType.TRACKING_EVIDENCE}),
            minimum_confidence=0.80,
            required_fields=frozenset(
                {"tracking_number", "promised_date", "delivery_status"}
            ),
        ),
    ),
}


@dataclass(frozen=True)
class EvidenceBundleResult:
    status: EvidenceBundleStatus
    reasons: tuple[str, ...]
    document_ids: tuple[str, ...]


def evaluate_evidence_bundle(
    claim_type: ClaimType,
    classifications: dict[str, EvidenceClassification],
    extractions: dict[str, ExtractedDocument],
    safety_decisions: dict[str, str],
) -> EvidenceBundleResult:
    """Evaluate evidence using deterministic rules before promotion.

    This function deliberately has no Azure or repository dependencies so the
    promotion decision can be tested independently from the workflow runtime.
    """
    if any(value == "block" for value in safety_decisions.values()):
        return EvidenceBundleResult(
            status=EvidenceBundleStatus.REJECTED,
            reasons=("Content Safety blocked at least one document.",),
            document_ids=(),
        )

    if any(value == "review" for value in safety_decisions.values()):
        return EvidenceBundleResult(
            status=EvidenceBundleStatus.HUMAN_REVIEW,
            reasons=("Content Safety requires human review.",),
            document_ids=tuple(classifications),
        )

    requirements = REQUIREMENTS.get(claim_type)
    if requirements is None:
        return EvidenceBundleResult(
            status=EvidenceBundleStatus.NEEDS_INFORMATION,
            reasons=(f"No evidence requirements are configured for {claim_type.value}.",),
            document_ids=(),
        )

    selected_document_ids: list[str] = []
    reasons: list[str] = []
    low_confidence = False

    for requirement in requirements:
        matching_ids = [
            document_id
            for document_id, classification in classifications.items()
            if classification.evidence_type in requirement.evidence_types
        ]
        if not matching_ids:
            reasons.append(f"Missing {requirement.name}.")
            continue

        requirement_satisfied = False
        requirement_has_missing_fields = False
        for document_id in matching_ids:
            classification = classifications[document_id]
            if classification.confidence < requirement.minimum_confidence:
                low_confidence = True
                continue

            if classification.validation_status.lower() in {
                "unreadable",
                "invalid",
                "rejected",
            }:
                requirement_has_missing_fields = True
                continue

            if requirement.name == "visible_damage" and (
                classification.damage_visible is not True
            ):
                requirement_has_missing_fields = True
                continue

            extraction = extractions.get(document_id)
            extracted_fields = set(extraction.key_values) if extraction else set()
            missing_fields = requirement.required_fields - extracted_fields
            if missing_fields:
                requirement_has_missing_fields = True
                reasons.append(
                    f"{document_id} is missing extracted fields: "
                    f"{', '.join(sorted(missing_fields))}."
                )
                continue

            requirement_satisfied = True
            selected_document_ids.append(document_id)
            break

        if not requirement_satisfied and requirement_has_missing_fields:
            reasons.append(f"{requirement.name} needs additional or clearer evidence.")

    if low_confidence:
        reasons.append("At least one required evidence classification has low confidence.")
        return EvidenceBundleResult(
            status=EvidenceBundleStatus.HUMAN_REVIEW,
            reasons=tuple(reasons),
            document_ids=tuple(selected_document_ids),
        )

    if reasons:
        return EvidenceBundleResult(
            status=EvidenceBundleStatus.NEEDS_INFORMATION,
            reasons=tuple(reasons),
            document_ids=tuple(selected_document_ids),
        )

    return EvidenceBundleResult(
        status=EvidenceBundleStatus.READY,
        reasons=(),
        document_ids=tuple(selected_document_ids),
    )

