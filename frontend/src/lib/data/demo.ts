import type { Claim, ReviewDetail, Role } from "@/lib/types";
let claims: Claim[] = [];
let reviews: Record<string, ReviewDetail> = {};
export function resetDemo() {
    const statuses = ["pending_approval", "needs_information", "refunded", "refund_failed", "processing", "rejected", "pending_ai_capacity", "approved", "refund_submitted"];
    claims = statuses.map((status, i) => ({ id: `RF-${1042 + i}`, customer_id: "demo-customer", customer_email: "alex@example.test", order_id: `ORD-${8201 + i}`, claim_type: ["damaged_item", "wrong_item", "non_delivery", "delayed_delivery"][i % 4], reason: "The delivered item does not match the expected condition. Please review the attached evidence.", requested_amount: i === 0 ? "649.00" : `${[89, 129, 79, 24, 49][i % 5]}.00`, currency: "CAD", status, created_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(), updated_at: new Date().toISOString() }));
    reviews = Object.fromEntries(claims.map(claim => [claim.id, { claim, approvals: [], assessment: { claim_id: claim.id, eligible: true, proposed_refund_amount: claim.requested_amount, confidence: 0.94, requires_two_reviewers: Number(claim.requested_amount) > 500, summary: "Evidence supports the reported issue. Confirm the order and cited policy before recording your decision.", policy_snapshot_id: "demo-policy-2026-01", criteria: [{ name: "Order eligibility", status: "pass", explanation: "The synthetic order is within the return window.", evidence_document_ids: ["demo-receipt"], citations: [{ policy_id: "returns", policy_version: "2026-01", chunk_id: "returns-01", title: "Refund eligibility", quote: "Items received damaged or incorrect qualify for review within 30 calendar days of delivery." }] }, { name: "Evidence quality", status: "review", explanation: "Inspect the receipt and reported damage before deciding.", evidence_document_ids: ["demo-photo"], citations: [{ policy_id: "evidence", policy_version: "2026-01", chunk_id: "evidence-02", title: "Supporting evidence", quote: "The customer should provide an order confirmation and clear evidence supporting the issue." }] }] } }]));
}
resetDemo();
export async function demoRequest(path: string, init: RequestInit, role: Role, identity: string): Promise<unknown> {
    await new Promise(resolve => setTimeout(resolve, 250));
    const url = new URL(path, "https://demo.invalid");
    const parts = url.pathname.split("/").filter(Boolean);
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (parts[0] === "demo" && parts[1] === "claims" && parts[3] === "information" && init.method === "POST") {
        if (role !== "Customer") throw new Error("Customer access required");
        const claim = claims.find(value => value.id === parts[2]);
        if (!claim || claim.status !== "needs_information") throw new Error("409: Claim is not awaiting information");
        if (typeof body.response !== "string" || body.response.trim().length < 10 || body.response.length > 2000) throw new Error("Response must contain 10 to 2,000 characters");
        claim.status = "processing";
        claim.updated_at = new Date().toISOString();
        return { status: "processing", response: body.response.trim() };
    }
    if (parts[1] === "admin") {
        if (role !== "Admin")
            throw new Error("Administrator access required");
        const by_status = claims.reduce<Record<string, number>>((acc, c) => (acc[c.status] = (acc[c.status] || 0) + 1, acc), {});
        return { total_claims: claims.length, pending_approval: by_status.pending_approval || 0, refunded: by_status.refunded || 0, rejected: by_status.rejected || 0, decision_rate: ((by_status.refunded || 0) + (by_status.rejected || 0)) / Math.max(1, claims.length), by_status };
    }
    if (parts[1] === "reviews") {
        if (role === "Customer")
            throw new Error("Reviewer access required");
        const review = reviews[parts[2]];
        if (!review)
            throw new Error("Assessment is not ready");
        if (parts[3] === "decision") {
            if (body.decision !== "approve" && body.decision !== "reject") throw new Error("Invalid reviewer decision");
            if (typeof body.comment !== "string" || body.comment.trim().length < 3 || body.comment.length > 2000) throw new Error("Rationale must contain 3 to 2,000 characters");
            if (review.claim.status !== "pending_approval")
                throw new Error("409: Claim is no longer awaiting approval");
            if (review.approvals.some(a => a.reviewer_id === identity))
                throw new Error("409: You have already decided this claim. A distinct reviewer is required.");
            review.approvals.push({ claim_id: review.claim.id, reviewer_id: identity, reviewer_name: identity, decision: body.decision, comment: body.comment });
            if (body.decision === "reject")
                review.claim.status = "rejected";
            else if (review.approvals.length >= (review.assessment.requires_two_reviewers ? 2 : 1))
                review.claim.status = "approved";
            return { status: "accepted" };
        }
        return structuredClone(review);
    }
    if (parts[1] !== "claims")
        throw new Error("Unsupported demo action");
    if (parts.length === 2) {
        if (init.method === "POST") {
            if (role !== "Customer")
                throw new Error("Customer access required");
            const claim: Claim = { ...body, id: `RF-${Date.now()}`, customer_id: "demo-customer", customer_email: "alex@example.test", status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            claims.unshift(claim);
            return structuredClone(claim);
        }
        return structuredClone(claims.filter(c => !url.searchParams.get("status") || c.status === url.searchParams.get("status")));
    }
    const claim = claims.find(c => c.id === parts[2]);
    if (!claim)
        throw new Error("Claim not found");
    if (parts.length > 3 && role !== "Customer") throw new Error("Customer access required");
    if (parts[3] === "submit") {
        if (!["draft", "uploading"].includes(claim.status)) throw new Error("409: Claim is already submitted");
        claim.status = "scanning";
        return { status: "scanning", workflow_instance_id: "demo-workflow" };
    }
    if (parts[3] === "uploads")
        return parts[5] === "complete" ? { status: "uploaded", document_id: parts[4] } : { document_id: `demo-${Date.now()}`, upload_url: "demo://upload", required_headers: {} };
    if (parts.length > 3) throw new Error("Unsupported demo action");
    return structuredClone(claim);
}
