"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DataState, PageHeader } from "@/components/claim-components";
import { ClaimsTable } from "@/components/claims-table";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { useClaimsQuery } from "@/lib/store";

export default function ClaimsPage() {
  const session = useSession();
  const [status, setStatus] = useState("all");
  const args = useMemo(() => ({ mode: session.mode, role: session.role, accountKey: session.accountKey, path: status === "all" ? "/v1/claims" : `/v1/claims?status=${encodeURIComponent(status)}` }), [session.accountKey, session.mode, session.role, status]);
  const query = useClaimsQuery(args);
  const customer = session.role === "Customer";
  return <AppShell><PageHeader title={customer ? "My claims" : "Claims"} description={customer ? "Track your refund requests and see what happens next." : "Claims visible to your assigned workspace."} action={customer ? <Button asChild><Link href="/claims/new/issue">Start a claim</Link></Button> : undefined}/>
    <div className="filters"><label className="field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="needs_information">Needs information</option><option value="pending_approval">Awaiting approval</option><option value="processing">Processing</option><option value="refund_failed">Refund failed</option><option value="refunded">Refunded</option></select></label></div>
    <DataState loading={query.isLoading || (query.isFetching && !query.currentData)} error={query.error} empty={!query.isLoading && !query.error && !query.currentData?.length} onRetry={query.refetch}>{query.currentData && <ClaimsTable claims={query.currentData} reviewMode={!customer}/>}</DataState>
    {!query.isLoading && !query.error && !query.currentData?.length && customer && <section className="surface"><h2 className="section-title">How claims work</h2><p className="helper">Tell us what happened, add supporting evidence, then follow the review. A human reviews every refund decision.</p></section>}
  </AppShell>;
}
