"use client";

import { useMemo, useState } from "react";
import { ApiErrorState } from "@/components/api-error-state";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ClaimsTable } from "@/features/claims/claims-table";
import { CLAIM_STATUS_PRESENTATION, presentClaimStatus, sortClaimsByUpdated } from "@/features/claims/status";
import { CLAIM_STATUSES, type ClaimStatus } from "@/features/claims/types";
import { useGetAdminKpisQuery } from "@/features/operations/api";
import { TestOrderForm } from "@/features/operations/test-order-form";
import type { AdminKpis } from "@/features/operations/types";
import { formatPercent } from "@/features/reviews/decision";
import { useListReviewClaimsQuery } from "@/features/reviews/api";
import { reviewDetailHref } from "@/features/reviews/routes";
import styles from "./operations.module.css";

const ALL_STATUSES = "all";
const KPI_POLL_INTERVAL_MS = 60_000;
const STATUS_OPTIONS = [{ value: ALL_STATUSES, label: "All statuses" }, ...CLAIM_STATUSES.map((status) => ({ value: status, label: CLAIM_STATUS_PRESENTATION[status].label }))];
const ADMIN_FORBIDDEN_MESSAGES = { forbidden: { title: "You do not have access", description: "Operations metrics are only available to Admins. Ask your administrator for access, or sign in with a different account." } };

function KpiTiles({ kpis }: { kpis: AdminKpis }) {
    const metrics = [
        { label: "Total claims", value: String(kpis.total_claims), icon: <path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" /> },
        { label: "Awaiting review", value: String(kpis.pending_approval), icon: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></> },
        { label: "Refunded", value: String(kpis.refunded), icon: <path d="m4 12 5 5L20 6" /> },
        { label: "Rejected", value: String(kpis.rejected), icon: <path d="M6 6l12 12M18 6 6 18" /> },
        { label: "Decision rate", value: formatPercent(kpis.decision_rate), icon: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /> },
    ];
    return <ul className={`dl-claims-summary ${styles.kpis}`} aria-label="Claim metrics">
        {metrics.map((metric) => <li key={metric.label} className="dl-card dl-metric">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{metric.icon}</svg>
            <div><span>{metric.label}</span><strong>{metric.value}</strong></div>
        </li>)}
    </ul>;
}

function StatusBreakdown({ kpis }: { kpis: AdminKpis }) {
    const rows = Object.entries(kpis.by_status).filter(([, count]) => count > 0).sort(([, a], [, b]) => b - a);
    const max = Math.max(1, ...rows.map(([, count]) => count));
    return <Card className={styles.section} aria-labelledby="breakdown-title">
        <h2 id="breakdown-title">Claims by status</h2>
        {rows.length ? <dl className={styles.breakdown}>
            {rows.map(([status, count]) => <div key={status}>
                <dt>{presentClaimStatus(status).label}</dt>
                <dd><span className={styles.bar} style={{ width: `${(count / max) * 100}%` }} aria-hidden="true" /><span>{count}</span></dd>
            </div>)}
        </dl> : <p className={styles.muted}>No claims yet.</p>}
    </Card>;
}

function AllClaims() {
    const [statusFilter, setStatusFilter] = useState<ClaimStatus | typeof ALL_STATUSES>(ALL_STATUSES);
    const { data, error, isLoading, isFetching, refetch } = useListReviewClaimsQuery(statusFilter === ALL_STATUSES ? undefined : { status: statusFilter });
    const claims = useMemo(() => sortClaimsByUpdated(data ?? []), [data]);

    let content: React.ReactNode;
    if (isLoading) content = <LoadingState message="Loading claims..." />;
    else if (error && !data) content = <ApiErrorState error={error} messages={ADMIN_FORBIDDEN_MESSAGES} onRetry={() => void refetch()} retrying={isFetching} />;
    else if (!claims.length) content = <EmptyState title="No claims found" description="No claims match this status." />;
    else content = <ClaimsTable claims={claims} hrefFor={reviewDetailHref} label="All claims" showCustomer />;

    return <section className={styles.claims} aria-labelledby="all-claims-title">
        <div className={styles.claimsHead}>
            <h2 id="all-claims-title">All claims</h2>
            <SelectField label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={(event) => setStatusFilter(event.target.value as ClaimStatus | typeof ALL_STATUSES)} />
        </div>
        <div aria-busy={isFetching}>{content}</div>
    </section>;
}

export function OperationsDashboard() {
    const { data: kpis, error, isLoading, isFetching, refetch } = useGetAdminKpisQuery(undefined, { pollingInterval: KPI_POLL_INTERVAL_MS, skipPollingIfUnfocused: true });

    let metrics: React.ReactNode;
    if (isLoading) metrics = <LoadingState message="Loading metrics..." />;
    else if (!kpis) metrics = <ApiErrorState error={error} messages={ADMIN_FORBIDDEN_MESSAGES} onRetry={() => void refetch()} retrying={isFetching} />;
    else metrics = <>
        {error && <Notice variant="warning" className={styles.stale}>We could not refresh the metrics. The numbers below may be out of date.</Notice>}
        <KpiTiles kpis={kpis} />
        <div className={styles.layout}><StatusBreakdown kpis={kpis} /><TestOrderForm /></div>
        <AllClaims />
    </>;

    return <>
        <header className="dl-page-head"><div><h1>Operations</h1><p>Monitor claim volume and decisions across all customers.</p></div></header>
        <div aria-busy={isFetching}>{metrics}</div>
    </>;
}
