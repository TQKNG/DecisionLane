"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { ApiErrorState } from "@/components/api-error-state";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { ClaimStatusBadge } from "@/features/claims/claim-status-badge";
import { formatAmount, formatClaimType, formatDateTime } from "@/features/claims/format";
import { shouldPollClaim } from "@/features/claims/status";
import { useGetReviewQuery } from "@/features/reviews/api";
import { AssessmentPanel } from "@/features/reviews/assessment-panel";
import { DecisionPanel } from "@/features/reviews/decision-panel";
import { EvidencePanel } from "@/features/reviews/evidence-panel";
import { STAFF_FORBIDDEN_MESSAGES } from "@/features/reviews/review-queue";
import { claimIdFromReviewPath, REVIEW_HOME } from "@/features/reviews/routes";
import type { RefundClaim } from "@/features/claims/types";
import { isApiError } from "@/lib/api/base-query";
import styles from "./reviews.module.css";

const REVIEW_POLL_INTERVAL_MS = 5_000;
const BACK_TO_QUEUE = <Button asChild variant="outline" size="pill"><Link href={REVIEW_HOME}>Back to the review queue</Link></Button>;

function ClaimPanel({ claim }: { claim: RefundClaim }) {
    return <Card className={styles.section} aria-labelledby="claim-title">
        <div className={styles.sectionHead}><h2 id="claim-title">Claim</h2><ClaimStatusBadge status={claim.status} /></div>
        <dl className={styles.facts}>
            <div><dt>Customer</dt><dd>{claim.customer_email}</dd></div>
            <div><dt>Order</dt><dd>{claim.order_id}</dd></div>
            <div><dt>Reason</dt><dd>{formatClaimType(claim.claim_type)}</dd></div>
            <div><dt>Requested refund</dt><dd>{formatAmount(claim.requested_amount, claim.currency)}</dd></div>
            <div><dt>Created</dt><dd><time dateTime={claim.created_at}>{formatDateTime(claim.created_at)}</time></dd></div>
            <div><dt>Last updated</dt><dd><time dateTime={claim.updated_at}>{formatDateTime(claim.updated_at)}</time></dd></div>
            <div className={styles.wide}><dt>What happened</dt><dd className={styles.summary}>{claim.reason}</dd></div>
        </dl>
    </Card>;
}

export function ReviewDetailView() {
    const claimId = claimIdFromReviewPath(usePathname());
    const { userId } = useSession();
    const { data: review, error, isLoading, isFetching, refetch } = useGetReviewQuery(claimId ?? skipToken, { refetchOnMountOrArgChange: true });
    const assessmentPending = !review && isApiError(error) && error.kind === "conflict";
    // A second subscription polls while the workflow can still change the claim, or while the assessment is being prepared.
    useGetReviewQuery(claimId && (assessmentPending || shouldPollClaim(review?.claim.status)) ? claimId : skipToken, { pollingInterval: REVIEW_POLL_INTERVAL_MS, skipPollingIfUnfocused: true });

    let content: React.ReactNode;
    if (!claimId || (!review && isApiError(error) && error.kind === "not_found")) content = <EmptyState title="We could not find this claim" description="Check the link, or open the claim from the review queue." action={BACK_TO_QUEUE} />;
    else if (isLoading) content = <LoadingState message="Loading the review..." />;
    else if (assessmentPending) content = <EmptyState title="Assessment in progress" description="This claim does not have an assessment yet. This page checks again automatically." action={BACK_TO_QUEUE} />;
    else if (!review) content = <ApiErrorState error={error} messages={STAFF_FORBIDDEN_MESSAGES} onRetry={() => void refetch()} retrying={isFetching} action={BACK_TO_QUEUE} />;
    else content = <>
        {error && <Notice variant="warning" className={styles.stale}>We could not refresh this review. The details below may be out of date.</Notice>}
        <div className={styles.layout}>
            <div className={styles.column}>
                <ClaimPanel claim={review.claim} />
                <AssessmentPanel assessment={review.assessment} currency={review.claim.currency} documents={review.documents} />
                <EvidencePanel documents={review.documents} />
            </div>
            <div className={styles.column}><DecisionPanel review={review} reviewerId={userId} onDecided={() => void refetch()} /></div>
        </div>
    </>;

    return <>
        <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href={REVIEW_HOME}>Review queue</Link><span aria-hidden="true">/</span><span aria-current="page">{claimId ?? "Claim"}</span></nav>
        <header className="dl-page-head"><div><h1 className={styles.title}>{claimId ? `Review ${claimId}` : "Review"}</h1><p>Check the assessment against the evidence before you decide.</p></div></header>
        <div aria-busy={isFetching}>{content}</div>
    </>;
}
