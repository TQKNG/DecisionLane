// API boundary types for refund claims. Field names match backend/openapi/openapi.json.

export const CLAIM_STATUSES = [
    "draft",
    "uploading",
    "scanning",
    "processing",
    "needs_information",
    "pending_approval",
    "approved",
    "rejected",
    "refund_submitted",
    "refunded",
    "refund_failed",
    "pending_ai_capacity",
    "closed",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_TYPES = ["delayed_delivery", "non_delivery", "damaged_item", "wrong_item"] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

export interface RefundClaim {
    id: string;
    customer_id: string;
    customer_email: string;
    order_id: string;
    claim_type: ClaimType;
    reason: string;
    requested_amount: string;
    currency: string;
    status: ClaimStatus;
    workflow_instance_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ListClaimsArgs {
    status?: ClaimStatus;
}

export interface CreateClaimRequest {
    order_id: string;
    claim_type: ClaimType;
    reason: string;
    requested_amount: string;
    currency: string;
}

export interface UploadRequest {
    file_name: string;
    content_type: string;
    size_bytes: number;
}

/** Short-lived grant for one direct Blob upload. `upload_url` is signed: keep it in memory only and never log it. */
export interface UploadGrant {
    document_id: string;
    blob_name: string;
    upload_url: string;
    required_headers: Record<string, string>;
}

export interface UploadCompleteResponse {
    status: "verified";
    document_id: string;
}

export interface ClaimSubmissionResponse {
    status: "scanning";
    workflow_instance_id: string;
}
