import type { ReviewDetail } from "@/features/reviews/types";

export const REVIEW_DETAIL: ReviewDetail = {
    claim: {
        id: "claim-test-001",
        customer_id: "customer-test-001",
        customer_email: "customer@example.test",
        order_id: "order-test-001",
        claim_type: "damaged_item",
        reason: "The parcel arrived with a crushed corner.",
        requested_amount: "42.50",
        currency: "CAD",
        status: "pending_approval",
        workflow_instance_id: "workflow-test-001",
        created_at: "2026-01-02T10:00:00Z",
        updated_at: "2026-01-03T12:30:00Z",
    },
    assessment: {
        claim_id: "claim-test-001",
        eligible: true,
        proposed_refund_amount: "42.50",
        confidence: 0.86,
        requires_two_reviewers: false,
        summary: "Synthetic assessment summary.",
        criteria: [{ name: "Damage shown", status: "pass", explanation: "The photo shows damage.", evidence_document_ids: ["document-test-001"], citations: [{ policy_id: "policy-test", policy_version: "1", chunk_id: "chunk-1", title: "Damaged items", quote: "Synthetic policy text." }] }],
        model_deployment: "synthetic-model",
        prompt_version: "test-1",
        policy_snapshot_id: "snapshot-test-001",
        trace_id: null,
    },
    documents: [{
        document: { id: "document-test-001", claim_id: "claim-test-001", file_name: "damage.png", content_type: "image/png", size_bytes: 2048, blob_name: "claims/claim-test-001/document-test-001", status: "extraction_complete", upload_verification_status: "verified", created_at: "2026-01-02T10:05:00Z" },
        classification: { evidence_type: "damage_photo", confidence: 0.9, image_quality: "good", damage_visible: true, damage_type: "crushed", reason: "Synthetic classification.", validation_status: "valid", analyzer_id: "synthetic-analyzer" },
        download_path: "/v1/reviews/claim-test-001/documents/document-test-001",
    }],
    approvals: [],
};
