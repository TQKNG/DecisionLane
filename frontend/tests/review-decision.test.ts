import { describe, expect, it } from "vitest";
import { COMMENT_MAX_LENGTH, formatPercent, reviewProgress, validateDecisionForm } from "@/features/reviews/decision";
import { claimIdFromReviewPath, reviewDetailHref } from "@/features/reviews/routes";
import type { ApprovalRecord, ReviewDetail } from "@/features/reviews/types";
import { REVIEW_DETAIL } from "./support/review-fixtures";

function approval(reviewerId: string, decision: ApprovalRecord["decision"]): ApprovalRecord {
    return { claim_id: REVIEW_DETAIL.claim.id, reviewer_id: reviewerId, reviewer_name: `Reviewer ${reviewerId}`, decision, comment: "Synthetic decision comment." };
}

function review(overrides: { approvals?: ApprovalRecord[]; twoReviewers?: boolean; status?: ReviewDetail["claim"]["status"] } = {}): ReviewDetail {
    return {
        ...REVIEW_DETAIL,
        claim: { ...REVIEW_DETAIL.claim, status: overrides.status ?? "pending_approval" },
        assessment: { ...REVIEW_DETAIL.assessment, requires_two_reviewers: overrides.twoReviewers ?? false },
        approvals: overrides.approvals ?? [],
    };
}

describe("validateDecisionForm", () => {
    it("requires a decision and a comment", () => {
        expect(validateDecisionForm({ decision: "", comment: " " })).toEqual({ decision: expect.any(String), comment: expect.any(String) });
    });

    it("enforces the backend comment length limits", () => {
        expect(validateDecisionForm({ decision: "approve", comment: "ok" }).comment).toBeDefined();
        expect(validateDecisionForm({ decision: "approve", comment: "x".repeat(COMMENT_MAX_LENGTH + 1) }).comment).toBeDefined();
        expect(validateDecisionForm({ decision: "reject", comment: "Evidence does not match the order." })).toEqual({});
    });
});

describe("reviewProgress", () => {
    it("lets a reviewer decide a claim awaiting approval", () => {
        expect(reviewProgress(review(), "reviewer-a")).toMatchObject({ requiredApprovals: 1, canDecide: true, awaitingSecondReviewer: false, yourDecision: undefined });
    });

    it("waits for a second, different reviewer after one approval", () => {
        const progress = reviewProgress(review({ twoReviewers: true, approvals: [approval("reviewer-a", "approve")] }), "reviewer-b");
        expect(progress).toMatchObject({ requiredApprovals: 2, canDecide: true, awaitingSecondReviewer: true });
    });

    it("does not let the same reviewer decide twice", () => {
        const progress = reviewProgress(review({ twoReviewers: true, approvals: [approval("reviewer-a", "approve")] }), "reviewer-a");
        expect(progress.canDecide).toBe(false);
        expect(progress.yourDecision?.decision).toBe("approve");
    });

    it("closes decisions once the claim leaves pending approval", () => {
        expect(reviewProgress(review({ status: "rejected", approvals: [approval("reviewer-a", "reject")] }), "reviewer-b")).toMatchObject({ canDecide: false, awaitingSecondReviewer: false });
    });
});

describe("review routes", () => {
    it("round-trips claim ids through review detail URLs", () => {
        expect(reviewDetailHref("claim test/001")).toBe("/review/claim%20test%2F001/");
        expect(claimIdFromReviewPath(reviewDetailHref("claim test/001"))).toBe("claim test/001");
    });

    it.each(["/review/", "/review/detail/", "/review/a/b/", "/claims/claim-test-001/", null])("rejects %s", (pathname) => {
        expect(claimIdFromReviewPath(pathname)).toBeUndefined();
    });
});

describe("formatPercent", () => {
    it("rounds and clamps fractions", () => {
        expect(formatPercent(0.874)).toBe("87%");
        expect(formatPercent(1.4)).toBe("100%");
        expect(formatPercent(undefined)).toBe("Not available");
    });
});
