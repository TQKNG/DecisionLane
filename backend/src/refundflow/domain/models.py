from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

def utc_now() -> datetime:
    return datetime.now(UTC)


class ClaimType(StrEnum):
    DELAYED_DELIVERY = 'delayed_delivery'
    NON_DELIVERY = 'non_delivery'
    DAMAGED_ITEM = 'damaged_item'
    WRONG_ITEM = 'wrong_item'

class ClaimStatus(StrEnum):
    DRAFT = "draft"
    UPLOADING = 'uploading'
    SCANNING = 'scanning'
    PROCESSING = 'processing'
    NEEDS_INFORMATION = 'needs_information'
    PENDING_APPROVAL = 'pending_approval'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    REFUND_SUBMITTED = 'refund_submitted'
    REFUNDED = 'refunded'
    REFUND_FAILED = 'refund_failed'
    PENDING_AI_CAPACITY = 'pending_ai_capacity'
    CLOSED = 'closed'

class DocumentProcessingStatus(StrEnum):
    UPLOADED = 'uploaded'
    MALWARE_SCANNING = 'malware_scanning'
    MALWARE_REJECTED = 'malware_rejected'
    SAFETY_SCANNING = 'safety_scanning'
    SAFETY_REVIEW_REQUIRED = 'safety_review_required'
    SAFETY_BLOCKED = 'safety_blocked'
    READY_FOR_EXTRACTION = 'ready_for_extraction'
    EXTRACTING = 'extracting'
    EXTRACTION_COMPLETE = 'extraction_complete'
    PROCESSING_FAILED = 'processing_failed'

class SafetyDecision(StrEnum):
    PASS = 'pass'
    REVIEW = 'review'
    BLOCK = 'block'

class CriterionStatus(StrEnum):
    PASS = 'pass'
    FAIL = 'fail'
    REVIEW = 'review'

class ClaimDocument(BaseModel):
    id: str
    claim_id:str
    file_name:str
    content_type:str
    size_bytes: int
    blob_name:str
    status:DocumentProcessingStatus =DocumentProcessingStatus.UPLOADED
    created_at: datetime = Field(default_factory=utc_now)

class RefundClaim(BaseModel):
    id: str
    customer_id: str
    customer_email: str
    order_id:str
    claim_type: ClaimType
    reason: str = Field(min_length=10, max_length=2000)
    requested_amount: Decimal = Field(gt=0)
    currency:str = "CAD"
    status: ClaimStatus = ClaimStatus.DRAFT
    workflow_instance_id: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

class PolicyCitation(BaseModel):
    policy_id: str
    policy_version:str
    chunk_id: str
    title: str
    quote: str

# Tieu chi danh gia
class AssessmentCriterion(BaseModel):
    name: str
    status: CriterionStatus
    explanation:str
    evidence_document_ids: list[str] = Field(default_factory=list)
    citations: list[PolicyCitation] = Field(default_factory=list)

class AssessmentDraft(BaseModel):
    eligible: bool
    proposed_refund_amount: Decimal = Field(ge=0)
    confidence: float = Field(ge=0, le=1)
    requires_two_reviewers: bool
    summary: str
    criteria: list[AssessmentCriterion]

class AssessmentResult(BaseModel):
    claim_id: str
    eligible: bool
    proposed_refund_amount: Decimal = Field(ge=0)
    confidence: float = Field(ge=0, le=1)
    requires_two_reviewers: bool
    summary: str
    criteria: list[AssessmentCriterion]
    model_deployment: str
    prompt_version: str
    policy_snapshot_id: str
    trace_id: str | None = None

class ClaimAggregateItem(BaseModel):
    id: str
    claim_id: str
    item_type: str
    payload: Dict[str, Any]
    created_at: Field(default_factory = utc_now)
    ttl: int | None = None