"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { ApiErrorState } from "@/components/api-error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { isApiError } from "@/lib/api/base-query";
import { useGetClaimQuery } from "@/features/claims/api";
import { ClaimStatusBadge } from "@/features/claims/claim-status-badge";
import { ClaimStatusTracker } from "@/features/claims/claim-status-tracker";
import { formatAmount, formatClaimType, formatDateTime } from "@/features/claims/format";
import { CLAIMS_HOME, claimIdFromPath } from "@/features/claims/routes";
import { CLAIM_POLL_INTERVAL_MS, presentClaimStatus, shouldPollClaim } from "@/features/claims/status";
import type { RefundClaim } from "@/features/claims/types";
import styles from "./claim-detail.module.css";

const BACK_TO_CLAIMS = <Button asChild variant="outline" size="pill"><Link href={CLAIMS_HOME}>Back to your claims</Link></Button>;

function NotFound() {
    return <EmptyState title="We could not find this claim" description="Check the link, or open the claim from your claims list. Claims are only visible to the account that created them." action={BACK_TO_CLAIMS} />;
}

function ClaimSummary({ claim, lastChecked, refreshing, onRefresh }: { claim: RefundClaim; lastChecked?: number; refreshing: boolean; onRefresh: () => void }) {
    const presentation = presentClaimStatus(claim.status);
    const polling = shouldPollClaim(claim.status);
    return <div className={styles.layout}>
        <Card className={styles.section} aria-labelledby="claim-status-title">
            <div className={styles.statusHead}>
                <h2 id="claim-status-title">Current status</h2>
                <ClaimStatusBadge status={claim.status} />
            </div>
            <p className={styles.statusDescription} aria-live="polite">{presentation.description}</p>
            <p className={styles.actor}><span>Next step by</span> <strong>{presentation.actor}</strong></p>
            <ClaimStatusTracker status={claim.status} />
            <div className={styles.refresh}>
                <p>
                    {polling ? "Updates automatically while this page is open." : "This status will not change on its own."}
                    {lastChecked && <> Last checked <time dateTime={new Date(lastChecked).toISOString()}>{formatDateTime(new Date(lastChecked).toISOString())}</time>.</>}
                </p>
                <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>{refreshing ? "Checking..." : "Check now"}</Button>
            </div>
        </Card>

        <Card className={styles.section} aria-labelledby="claim-details-title">
            <h2 id="claim-details-title">Claim details</h2>
            <dl className={styles.details}>
                <div><dt>Order</dt><dd>{claim.order_id}</dd></div>
                <div><dt>Reason</dt><dd>{formatClaimType(claim.claim_type)}</dd></div>
                <div><dt>Requested refund</dt><dd>{formatAmount(claim.requested_amount, claim.currency)}</dd></div>
                <div><dt>Created</dt><dd><time dateTime={claim.created_at}>{formatDateTime(claim.created_at)}</time></dd></div>
                <div><dt>Last updated</dt><dd><time dateTime={claim.updated_at}>{formatDateTime(claim.updated_at)}</time></dd></div>
                <div className={styles.wide}><dt>What happened</dt><dd className={styles.reason}>{claim.reason}</dd></div>
            </dl>
        </Card>
    </div>;
}

export function ClaimDetail() {
    const claimId = claimIdFromPath(usePathname());
    const { data: claim, error, isLoading, isFetching, fulfilledTimeStamp, refetch } = useGetClaimQuery(claimId ?? skipToken, { refetchOnMountOrArgChange: true });
    // Polling is controlled by a second subscription so the interval follows the latest status.
    useGetClaimQuery(claimId && shouldPollClaim(claim?.status) ? claimId : skipToken, { pollingInterval: CLAIM_POLL_INTERVAL_MS, skipPollingIfUnfocused: true });

    let content: React.ReactNode;
    if (!claimId) content = <NotFound />;
    else if (isLoading) content = <LoadingState message="Loading your claim..." />;
    else if (!claim && isApiError(error) && error.kind === "not_found") content = <NotFound />;
    else if (!claim) content = <ApiErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} action={BACK_TO_CLAIMS} />;
    else content = <>
        {error && <Notice variant="warning" className={styles.stale}>We could not refresh this claim. The details below may be out of date.</Notice>}
        <ClaimSummary claim={claim} lastChecked={fulfilledTimeStamp} refreshing={isFetching} onRefresh={() => void refetch()} />
    </>;

    return <>
        <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href={CLAIMS_HOME}>Your claims</Link><span aria-hidden="true">/</span><span aria-current="page">{claimId ?? "Claim"}</span></nav>
        <header className="dl-page-head"><div><h1 className={styles.title}>{claimId ? `Claim ${claimId}` : "Claim"}</h1><p>Follow your refund claim from submission to refund.</p></div></header>
        <div aria-busy={isFetching}>{content}</div>
    </>;
}
