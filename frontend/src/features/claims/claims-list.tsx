"use client";

import { useMemo } from "react";
import { ApiErrorState } from "@/components/api-error-state";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { useListClaimsQuery } from "@/features/claims/api";
import { ClaimsSummary } from "@/features/claims/claims-summary";
import { ClaimsTable } from "@/features/claims/claims-table";
import { sortClaimsByUpdated, summarizeClaims } from "@/features/claims/status";

export function ClaimsList() {
    const { data, error, isLoading, isFetching, refetch } = useListClaimsQuery();
    const claims = useMemo(() => sortClaimsByUpdated(data ?? []), [data]);
    const summary = useMemo(() => summarizeClaims(claims), [claims]);

    let content: React.ReactNode;
    if (isLoading) content = <LoadingState message="Loading your claims..." />;
    else if (error && !data) content = <ApiErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />;
    else if (!claims.length) content = <EmptyState title="No claims yet" description="When you request a refund for an order, your claim and its progress will appear here." />;
    else content = <>
        {error && <Notice variant="warning" className="dl-claims-stale">We could not refresh your claims. The list below may be out of date.</Notice>}
        <ClaimsSummary summary={summary} />
        <ClaimsTable claims={claims} />
    </>;

    return <>
        <header className="dl-page-head"><div><h1>Your claims</h1><p>Track your refund claims from submission to refund.</p></div></header>
        <div aria-busy={isFetching}>{content}</div>
    </>;
}
