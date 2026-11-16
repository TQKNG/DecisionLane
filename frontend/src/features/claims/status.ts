import type { BadgeVariant } from "@/components/ui/badge";
import { CLAIM_STATUSES, type ClaimStatus, type RefundClaim } from "@/features/claims/types";

export type ClaimActor = "You" | "DecisionLane" | "Reviewer";

export interface ClaimStatusPresentation {
    label: string;
    description: string;
    actor: ClaimActor;
    variant: BadgeVariant;
    /** True while the backend is still working on the claim and the status can change without customer action. */
    active: boolean;
}

export const CLAIM_STATUS_PRESENTATION: Record<ClaimStatus, ClaimStatusPresentation> = {
    draft: { label: "Draft", description: "Add your evidence and submit the claim.", actor: "You", variant: "neutral", active: false },
    uploading: { label: "Adding evidence", description: "Finish uploading your evidence and submit the claim.", actor: "You", variant: "neutral", active: false },
    scanning: { label: "Checking evidence", description: "We are checking your files for safety and readability.", actor: "DecisionLane", variant: "accent", active: true },
    processing: { label: "Assessing claim", description: "We are assessing your claim against the refund policy.", actor: "DecisionLane", variant: "accent", active: true },
    pending_ai_capacity: { label: "Queued for assessment", description: "Your claim is queued and will be assessed shortly.", actor: "DecisionLane", variant: "accent", active: true },
    needs_information: { label: "More information needed", description: "We need more information before we can continue.", actor: "You", variant: "warning", active: false },
    pending_approval: { label: "Awaiting review", description: "A reviewer is checking the assessment.", actor: "Reviewer", variant: "warning", active: true },
    approved: { label: "Approved", description: "Your claim was approved and the refund is being prepared.", actor: "DecisionLane", variant: "success", active: true },
    refund_submitted: { label: "Refund processing", description: "Your refund has been sent to the payment provider.", actor: "DecisionLane", variant: "success", active: true },
    refunded: { label: "Refunded", description: "Your refund is complete.", actor: "DecisionLane", variant: "success", active: false },
    refund_failed: { label: "Refund delayed", description: "We could not complete the refund. Our team will follow up.", actor: "DecisionLane", variant: "destructive", active: false },
    rejected: { label: "Not approved", description: "Your claim was not approved.", actor: "Reviewer", variant: "destructive", active: false },
    closed: { label: "Closed", description: "This claim is closed.", actor: "DecisionLane", variant: "neutral", active: false },
};

export function isClaimStatus(value: string): value is ClaimStatus {
    return (CLAIM_STATUSES as readonly string[]).includes(value);
}

/** Presents a backend status, falling back to the raw value for statuses this client does not know yet. */
export function presentClaimStatus(status: string): ClaimStatusPresentation {
    if (isClaimStatus(status)) return CLAIM_STATUS_PRESENTATION[status];
    return { label: status.replace(/_/g, " "), description: "This claim has an updated status.", actor: "DecisionLane", variant: "neutral", active: false };
}

export interface ClaimsSummary {
    total: number;
    inProgress: number;
    needsAction: number;
    refunded: number;
}

export function summarizeClaims(claims: readonly RefundClaim[]): ClaimsSummary {
    return claims.reduce<ClaimsSummary>((summary, claim) => {
        const presentation = presentClaimStatus(claim.status);
        return {
            total: summary.total + 1,
            inProgress: summary.inProgress + (presentation.active ? 1 : 0),
            needsAction: summary.needsAction + (presentation.actor === "You" ? 1 : 0),
            refunded: summary.refunded + (claim.status === "refunded" ? 1 : 0),
        };
    }, { total: 0, inProgress: 0, needsAction: 0, refunded: 0 });
}

/** Most recently updated claims first; claims without a timestamp sort last. */
export function sortClaimsByUpdated(claims: readonly RefundClaim[]): RefundClaim[] {
    const time = (claim: RefundClaim) => Date.parse(claim.updated_at || claim.created_at) || 0;
    return [...claims].sort((a, b) => time(b) - time(a));
}
