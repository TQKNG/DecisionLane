"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { ClaimsTable } from "@/components/claims-table";
import { DataState, PageHeader, StatusBadge } from "@/components/claim-components";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { useClaimsQuery, useKpisQuery } from "@/lib/store";
import { label } from "@/lib/types";

const EXCEPTION_STATUSES = new Set(["processing", "pending_ai_capacity", "needs_information"]);
const PAGE_SIZE = 5;

function useOperationsQuery() {
  const session = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const filters = {
    query: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "all",
    sort: searchParams.get("sort") ?? "newest",
    page: Number.isFinite(requestedPage) && Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };

  function updateFilters(next: Partial<typeof filters>) {
    const params = new URLSearchParams(searchParams.toString());
    const changedPage = Object.keys(next).some((key) => key !== "page");
    const values = { ...filters, ...next, page: changedPage ? 1 : next.page ?? filters.page };
    Object.entries(values).forEach(([key, value]) => {
      const parameterKey = key === "query" ? "q" : key;
      if ((key === "status" && value === "all") || (key === "sort" && value === "newest") || (key === "query" && value === "") || (key === "page" && value === 1)) params.delete(parameterKey);
      else params.set(parameterKey, String(value));
    });
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
  }
  return { session, filters, updateFilters };
}

export function OperationsWorkspace() {
  const { session, filters, updateFilters } = useOperationsQuery();
  const authorized = session.authenticated && session.role === "Admin";
  const querySession = { mode: session.mode, role: session.role, accountKey: session.accountKey };
  const kpis = useKpisQuery({ ...querySession, path: "/v1/admin/kpis" }, { skip: !authorized });
  const claims = useClaimsQuery({ ...querySession, path: "/v1/claims" }, { skip: !authorized, pollingInterval: 30_000 });
  const filteredClaims = useMemo(() => {
    const lowerQuery = filters.query.trim().toLowerCase();
    const selected = (claims.data ?? []).filter((claim) => {
      const matchesStatus = filters.status === "all" || (filters.status === "decided" && ["refunded", "rejected"].includes(claim.status)) || claim.status === filters.status;
      const haystack = `${claim.id} ${claim.order_id} ${claim.customer_email} ${claim.claim_type}`.toLowerCase();
      return matchesStatus && (!lowerQuery || haystack.includes(lowerQuery));
    });
    return selected.sort((first, second) => filters.sort === "oldest" ? Date.parse(first.created_at) - Date.parse(second.created_at) : filters.sort === "amount" ? Number(second.requested_amount) - Number(first.requested_amount) : Date.parse(second.created_at) - Date.parse(first.created_at));
  }, [claims.data, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const activePage = Math.min(filters.page, pageCount);
  const pageClaims = filteredClaims.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const exceptions = (claims.data ?? []).filter((claim) => EXCEPTION_STATUSES.has(claim.status));
  const failedRefunds = (claims.data ?? []).filter((claim) => claim.status === "refund_failed");

  if (!authorized) return <section className="surface" role="alert"><p className="eyebrow">OPERATIONS ACCESS</p><h1 className="page-title">Administrator access is required</h1><p className="page-subtitle">Use an administrator account, or switch the explicit demo workspace to Administrator.</p><Button asChild><Link href="/sign-in">Return to sign in</Link></Button></section>;

  return <>
    <PageHeader title="Operations" description="Monitor exceptions and follow the claims behind every metric." action={<Button variant="secondary" onClick={() => { void kpis.refetch(); void claims.refetch(); }}>Refresh data</Button>} />
    <DataState loading={kpis.isLoading || claims.isLoading} error={kpis.error ?? claims.error} onRetry={() => { void kpis.refetch(); void claims.refetch(); }}>
      {kpis.data && <section className="metrics" aria-label="Operations metrics"><Metric label="Total claims" value={kpis.data.total_claims} href="/admin" /><Metric label="Awaiting approval" value={kpis.data.pending_approval} href="/admin?status=pending_approval" /><Metric label="Refund confirmed" value={kpis.data.refunded} href="/admin?status=refunded" /><Metric label="Rejected" value={kpis.data.rejected} href="/admin?status=rejected" /><Metric label="Decision rate" value={kpis.data.total_claims ? `${Math.round(kpis.data.decision_rate * 100)}%` : "No decisions"} href="/admin?status=decided" /></section>}
      <section className="surface"><div className="page-header"><div><h2 className="section-title">Actionable exceptions</h2><p className="helper">Claims requiring processing attention or additional customer information.</p></div><span className="status-badge">{exceptions.length} open</span></div>{exceptions.length === 0 ? <p className="helper">No processing exceptions are currently reported.</p> : <ul className="file-list">{exceptions.slice(0, 3).map((claim) => <li className="file-row" key={claim.id}><span><strong>{claim.id}</strong><br /><span className="helper">{claim.order_id} · {label(claim.claim_type)}</span></span><span><StatusBadge status={claim.status} /> <Link className="text-link" href={`/claims/detail?claimId=${encodeURIComponent(claim.id)}`}>Inspect</Link></span></li>)}</ul>}</section>
      <section className="surface"><div className="page-header"><div><h2 className="section-title">Failed refunds</h2><p className="helper">Payment recovery is not available in this workspace. Use the authorised payment operations process for live failures.</p></div><span className={`status-badge ${failedRefunds.length ? "danger" : "success"}`}>{failedRefunds.length} failed</span></div>{failedRefunds.length ? <ClaimsTable claims={failedRefunds} /> : <p className="helper">No failed refunds are currently reported.</p>}{session.mode === "demo" && <p className="notice">Demo data can show failure states for inspection. It does not initiate recovery or payment actions.</p>}</section>
      <section className="surface"><div className="page-header"><div><h2 className="section-title">Filtered claims</h2><p className="helper">Filters are reflected in this URL so you can share the exact operational view.</p></div><span className="helper">{filteredClaims.length} result{filteredClaims.length === 1 ? "" : "s"}</span></div><div className="filters" aria-label="Claim filters"><label className="field">Search claims<input type="search" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Claim, order, customer or issue" /></label><label className="field">Status<select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}><option value="all">All statuses</option><option value="decided">Decided (refunded or rejected)</option>{Object.keys(kpis.data?.by_status ?? {}).sort().map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label><label className="field">Sort<select value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Highest amount</option></select></label></div><DataState empty={filteredClaims.length === 0}><ClaimsTable claims={pageClaims} /></DataState>{pageCount > 1 && <nav className="button-row" aria-label="Claims pagination"><Button variant="secondary" disabled={activePage === 1} onClick={() => updateFilters({ page: activePage - 1 })}>Previous</Button><span className="helper">Page {activePage} of {pageCount}</span><Button variant="secondary" disabled={activePage === pageCount} onClick={() => updateFilters({ page: activePage + 1 })}>Next</Button></nav>}</section>
    </DataState>
  </>;
}

function Metric({ label: metricLabel, value, href }: { label: string; value: string | number; href: string }) {
  return <Link className="metric" href={href}><p className="metric-label">{metricLabel}</p><p className="metric-value">{value}</p><span className="text-link">View claims</span></Link>;
}
