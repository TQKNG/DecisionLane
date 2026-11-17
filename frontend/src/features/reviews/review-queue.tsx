"use client";

import { useMemo, useState } from "react";
import { ApiErrorState } from "@/components/api-error-state";
import { SelectField } from "@/components/ui/field";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { ClaimsTable } from "@/features/claims/claims-table";
import { CLAIM_STATUS_PRESENTATION, sortClaimsByUpdated } from "@/features/claims/status";
import { CLAIM_STATUSES, type ClaimStatus } from "@/features/claims/types";
import { useListReviewClaimsQuery } from "@/features/reviews/api";
import { reviewDetailHref } from "@/features/reviews/routes";
import styles from "./reviews.module.css";

const ALL_STATUSES = "all";
const QUEUE_POLL_INTERVAL_MS = 30_000;
const STATUS_OPTIONS = [
    { value: "pending_approval", label: "Awaiting review" },
    { value: ALL_STATUSES, label: "All statuses" },
    ...CLAIM_STATUSES.filter((status) => status !== "pending_approval").map((status) => ({ value: status, label: CLAIM_STATUS_PRESENTATION[status].label })),
];
export const STAFF_FORBIDDEN_MESSAGES = { forbidden: { title: "You do not have access", description: "Your account is not assigned the Reviewer or Admin role. Ask your administrator for access, or sign in with a different account." } };

export function ReviewQueue() {
    const [statusFilter, setStatusFilter] = useState<ClaimStatus | typeof ALL_STATUSES>("pending_approval");
    const { data, error, isLoading, isFetching, refetch } = useListReviewClaimsQuery(statusFilter === ALL_STATUSES ? undefined : { status: statusFilter }, { pollingInterval: QUEUE_POLL_INTERVAL_MS, skipPollingIfUnfocused: true });
    // Awaiting claims are oldest first so the longest waits are handled first; other views show the latest activity first.
    const claims = useMemo(() => {
        const sorted = sortClaimsByUpdated(data ?? []);
        return statusFilter === "pending_approval" ? [...sorted].reverse() : sorted;
    }, [data, statusFilter]);

    let content: React.ReactNode;
    if (isLoading) content = <LoadingState message="Loading claims..." />;
    else if (error && !data) content = <ApiErrorState error={error} messages={STAFF_FORBIDDEN_MESSAGES} onRetry={() => void refetch()} retrying={isFetching} />;
    else if (!claims.length) content = <EmptyState title={statusFilter === "pending_approval" ? "Nothing to review" : "No claims found"} description={statusFilter === "pending_approval" ? "Claims appear here when their assessment is ready for a reviewer decision. This list refreshes automatically." : "No claims match this status."} />;
    else content = <>
        {error && <Notice variant="warning" className={styles.stale}>We could not refresh the queue. The list below may be out of date.</Notice>}
        <ClaimsTable claims={claims} hrefFor={reviewDetailHref} label="Claims for review" showCustomer />
    </>;

    return <>
        <header className="dl-page-head"><div><h1>Review queue</h1><p>Check AI assessments and evidence, then approve or reject each claim.</p></div></header>
        <div className={styles.filters}>
            <SelectField label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={(event) => setStatusFilter(event.target.value as ClaimStatus | typeof ALL_STATUSES)} />
            <p className={styles.count} aria-live="polite">{data ? `${claims.length} ${claims.length === 1 ? "claim" : "claims"}` : ""}</p>
        </div>
        <div aria-busy={isFetching}>{content}</div>
    </>;
}
