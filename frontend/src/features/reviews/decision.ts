import { REVIEW_DECISIONS, type ApprovalRecord, type ReviewDecision, type ReviewDetail } from "@/features/reviews/types";

// Limits mirror ApprovalRequest in backend/api/routers/reviews.py.
export const COMMENT_MIN_LENGTH = 3;
export const COMMENT_MAX_LENGTH = 2000;

export interface DecisionFormValues {
    decision: ReviewDecision | "";
    comment: string;
}

export type DecisionFormErrors = Partial<Record<keyof DecisionFormValues, string>>;

export const EMPTY_DECISION_FORM: DecisionFormValues = { decision: "", comment: "" };

export function validateDecisionForm(values: DecisionFormValues): DecisionFormErrors {
    const errors: DecisionFormErrors = {};
    const comment = values.comment.trim();
    if (!values.decision || !(REVIEW_DECISIONS as readonly string[]).includes(values.decision)) errors.decision = "Choose whether to approve or reject the claim.";
    if (comment.length < COMMENT_MIN_LENGTH) errors.comment = `Explain your decision in at least ${COMMENT_MIN_LENGTH} characters.`;
    else if (comment.length > COMMENT_MAX_LENGTH) errors.comment = `Keep the explanation under ${COMMENT_MAX_LENGTH} characters.`;
    return errors;
}

export interface ReviewProgress {
    requiredApprovals: number;
    approvals: readonly ApprovalRecord[];
    yourDecision?: ApprovalRecord;
    /** True while the claim waits for a decision and the current reviewer can still give one. */
    canDecide: boolean;
    /** True when one reviewer approved and the workflow needs a second, different reviewer. */
    awaitingSecondReviewer: boolean;
}

/** Summarizes reviewer decisions, following the approval loop in backend/function_app.py. */
export function reviewProgress(review: ReviewDetail, reviewerId: string): ReviewProgress {
    const requiredApprovals = review.assessment.requires_two_reviewers ? 2 : 1;
    const approvals = review.approvals;
    const yourDecision = approvals.find((approval) => approval.reviewer_id === reviewerId);
    const approvedCount = approvals.filter((approval) => approval.decision === "approve").length;
    const pending = review.claim.status === "pending_approval";
    return {
        requiredApprovals,
        approvals,
        yourDecision,
        canDecide: pending && !yourDecision,
        awaitingSecondReviewer: pending && requiredApprovals === 2 && approvedCount === 1,
    };
}

export function formatPercent(fraction: number | null | undefined): string {
    if (typeof fraction !== "number" || !Number.isFinite(fraction)) return "Not available";
    return `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`;
}
