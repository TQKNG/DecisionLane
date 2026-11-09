"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClaimsTable } from "@/components/claims-table";
import { DataState, PageHeader, StatusBadge } from "@/components/claim-components";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { useClaimsQuery } from "@/lib/store";

const PAGE_SIZE = 6;

function QueueContent() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "pending_approval";
  const sort = params.get("sort") ?? "oldest";
  const requestedPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const endpoint = `/v1/claims${status === "all" ? "" : `?status=${encodeURIComponent(status)}`}`;
  const result = useClaimsQuery({ mode: session.mode, role: session.role, accountKey: session.accountKey, path: endpoint }, { skip: session.role === "Customer", pollingInterval: 30_000 });
  const update = (next: Record<string, string>) => {
    const output = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([key, value]) => value ? output.set(key, value) : output.delete(key));
    if (!("page" in next)) output.set("page", "1");
    router.replace(`${pathname}?${output.toString()}`);
  };
  const claims = useMemo(() => (result.currentData ?? []).filter(claim => {
    const term = query.trim().toLowerCase();
    return !term || [claim.id, claim.order_id, claim.claim_type, claim.status].some(value => value.toLowerCase().includes(term));
  }).sort((left, right) => {
    const delta = Date.parse(left.created_at) - Date.parse(right.created_at);
    return sort === "newest" ? -delta : sort === "amount" ? Number(right.requested_amount) - Number(left.requested_amount) : delta;
  }), [query, result.currentData, sort]);
  const count = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));
  const currentPage = Math.min(page, count);
  const visible = claims.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  if (session.role === "Customer") return <section className="surface" role="alert"><h1 className="section-title">Reviewer access required</h1><p className="helper">This workspace is available to reviewers and administrators.</p></section>;
  return <><PageHeader title="Review queue" description="Assess evidence and policy context before recording a human decision." /><section className="surface"><div className="filters" aria-label="Review queue filters"><label className="field">Search claims or orders<input value={query} onChange={event => update({ q: event.target.value })} placeholder="RF-1042 or ORD-8201" /></label><label className="field">Status<select value={status} onChange={event => update({ status: event.target.value })}><option value="pending_approval">Awaiting approval</option><option value="needs_information">Needs information</option><option value="processing">Processing</option><option value="all">All statuses</option></select></label><label className="field">Sort by<select value={sort} onChange={event => update({ sort: event.target.value })}><option value="oldest">Oldest first</option><option value="newest">Newest first</option><option value="amount">Highest amount</option></select></label></div>{status !== "all" && <p className="notice"><StatusBadge status={status} /> Showing claims with this authoritative status. Queue filters are shareable in the URL.</p>}<DataState loading={result.isLoading || (result.isFetching && !result.currentData)} error={result.error} empty={!result.isLoading && !result.error && claims.length === 0} onRetry={result.refetch}><ClaimsTable claims={visible} reviewMode /><nav className="button-row" aria-label="Queue pagination"><Button variant="secondary" disabled={currentPage <= 1} onClick={() => update({ page: String(currentPage - 1) })}>Previous</Button><span className="helper">Page {currentPage} of {count} · {claims.length} claim{claims.length === 1 ? "" : "s"}</span><Button variant="secondary" disabled={currentPage >= count} onClick={() => update({ page: String(currentPage + 1) })}>Next</Button></nav></DataState></section></>;
}

export default function ReviewsPage() {
  return <AppShell><Suspense fallback={<section className="surface" role="status">Loading review queue...</section>}><QueueContent /></Suspense></AppShell>;
}
