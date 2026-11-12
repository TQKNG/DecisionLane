from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable

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

