"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextareaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { presentClaimStatus } from "@/features/claims/status";
import { useDecideReviewMutation } from "@/features/reviews/api";
import { COMMENT_MAX_LENGTH, EMPTY_DECISION_FORM, reviewProgress, validateDecisionForm, type DecisionFormErrors, type DecisionFormValues } from "@/features/reviews/decision";
import type { ReviewDecision, ReviewDetail } from "@/features/reviews/types";
import { isApiError } from "@/lib/api/base-query";
import styles from "./reviews.module.css";

const DECISION_OPTIONS: readonly { value: ReviewDecision; label: string; description: string }[] = [
    { value: "approve", label: "Approve", description: "Agree with a refund for this claim." },
    { value: "reject", label: "Reject", description: "Decline the claim. The customer is notified." },
];

function decisionLabel(decision: string) {
    return decision === "approve" ? { label: "Approved", variant: "success" as const } : { label: "Rejected", variant: "destructive" as const };
}

export function DecisionPanel({ review, reviewerId, onDecided }: { review: ReviewDetail; reviewerId: string; onDecided: () => void }) {
    const progress = reviewProgress(review, reviewerId);
    const [values, setValues] = useState<DecisionFormValues>(EMPTY_DECISION_FORM);
    const [errors, setErrors] = useState<DecisionFormErrors>({});
    const [decide, { isLoading, error, isSuccess, reset }] = useDecideReviewMutation();
    const status = presentClaimStatus(review.claim.status);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextErrors = validateDecisionForm(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length || !values.decision) return;
        const result = await decide({ claimId: review.claim.id, decision: values.decision, comment: values.comment.trim() });
        if (!("error" in result)) onDecided();
    }

    let action: React.ReactNode;
    if (progress.yourDecision) action = <Notice variant="success">You {progress.yourDecision.decision === "approve" ? "approved" : "rejected"} this claim.{progress.awaitingSecondReviewer && " It now needs a decision from a second reviewer."}</Notice>;
    else if (isSuccess) action = <Notice variant="info">Your decision was sent. This page updates when the workflow records it.</Notice>;
    else if (!progress.canDecide) action = <Notice variant="info">This claim is not awaiting a decision. Current status: {status.label}.</Notice>;
    else action = <form className={styles.decisionForm} onSubmit={(event) => void submit(event)} noValidate>
        {progress.awaitingSecondReviewer && <Notice variant="info">Another reviewer approved this claim. Your decision completes the review.</Notice>}
        <fieldset className={styles.choices} aria-describedby={errors.decision ? "decision-error" : undefined} aria-invalid={Boolean(errors.decision)}>
            <legend>Decision</legend>
            {DECISION_OPTIONS.map((option) => <label key={option.value} className={styles.choice} data-selected={values.decision === option.value}>
                <input type="radio" name="decision" value={option.value} checked={values.decision === option.value} disabled={isLoading} onChange={() => { setValues({ ...values, decision: option.value }); reset(); }} />
                <span><strong>{option.label}</strong><span>{option.description}</span></span>
            </label>)}
            {errors.decision && <p id="decision-error" className="dl-field-error">{errors.decision}</p>}
        </fieldset>
        <TextareaField label="Reason for your decision" help="Recorded with the decision and visible to other reviewers." rows={4} maxLength={COMMENT_MAX_LENGTH} value={values.comment} error={errors.comment} disabled={isLoading} onChange={(event) => setValues({ ...values, comment: event.target.value })} />
        {error && <Notice variant="destructive">{isApiError(error) ? error.detail : "We could not send your decision. Please try again."}</Notice>}
        <Button type="submit" variant={values.decision === "reject" ? "destructive" : "default"} disabled={isLoading}>{isLoading ? "Sending..." : values.decision === "reject" ? "Reject claim" : values.decision === "approve" ? "Approve claim" : "Submit decision"}</Button>
    </form>;

    return <Card className={styles.section} aria-labelledby="decision-title">
        <div className={styles.sectionHead}>
            <h2 id="decision-title">Decision</h2>
            <span className={styles.muted}>{progress.approvals.filter((approval) => approval.decision === "approve").length} of {progress.requiredApprovals} approvals</span>
        </div>
        {action}
        {progress.approvals.length > 0 && <ul className={styles.approvals} aria-label="Reviewer decisions">
            {progress.approvals.map((approval) => {
                const label = decisionLabel(approval.decision);
                return <li key={approval.reviewer_id}>
                    <div className={styles.sectionHead}><strong>{approval.reviewer_id === reviewerId ? `${approval.reviewer_name} (you)` : approval.reviewer_name}</strong><Badge variant={label.variant}>{label.label}</Badge></div>
                    <p>{approval.comment}</p>
                </li>;
            })}
        </ul>}
    </Card>;
}
