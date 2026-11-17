// API boundary types for reviewer endpoints. Field names match backend/openapi/openapi.json and backend/api/routers/reviews.py.

import type { RefundClaim } from "@/features/claims/types";

export type CriterionStatus = "pass" | "fail" | "review";

export interface PolicyCitation {
    policy_id: string;
    policy_version: string;
    chunk_id: string;
    title: string;
    quote: string;
}

export interface AssessmentCriterion {
    name: string;
    status: CriterionStatus;
    explanation: string;
    evidence_document_ids: string[];
    citations: PolicyCitation[];
}

export interface AssessmentResult {
    claim_id: string;
    eligible: boolean;
    proposed_refund_amount: string;
    confidence: number;
    requires_two_reviewers: boolean;
    summary: string;
    criteria: AssessmentCriterion[];
    model_deployment: string;
    prompt_version: string;
    policy_snapshot_id: string;
    trace_id?: string | null;
}

export interface ClaimDocument {
    id: string;
    claim_id: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
    blob_name: string;
    status: string;
    upload_verification_status: string;
    verified_at?: string | null;
    evidence_type?: string | null;
    evidence_confidence?: number | null;
    created_at: string;
}

export interface EvidenceClassification {
    evidence_type: string;
    confidence: number;
    image_quality: string;
    shows_product?: boolean | null;
    damage_visible?: boolean | null;
    damage_type?: string | null;
    reason: string;
    validation_status: string;
    analyzer_id: string;
}

export interface ReviewEvidenceDocument {
    document: ClaimDocument;
    classification?: EvidenceClassification | null;
    /** API path for the evidence bytes. It needs a bearer token, so it cannot be used as a plain link. */
    download_path: string;
}

export const REVIEW_DECISIONS = ["approve", "reject"] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface ApprovalRecord {
    claim_id: string;
    reviewer_id: string;
    reviewer_name: string;
    decision: ReviewDecision;
    comment: string;
}

export interface ReviewDetail {
    claim: RefundClaim;
    assessment: AssessmentResult;
    documents: ReviewEvidenceDocument[];
    approvals: ApprovalRecord[];
}

export interface ReviewDecisionRequest {
    decision: ReviewDecision;
    comment: string;
}

export interface ReviewDecisionResponse {
    status: "accepted";
}
