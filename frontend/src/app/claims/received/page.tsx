"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DataState, PageHeader } from "@/components/claim-components";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { isSubmitted } from "@/features/customer/draft";
import { useClaimQuery } from "@/lib/store";

function Received() {
  const params = useSearchParams();
  const claimId = params.get("claimId");
  const session = useSession();
  const query = useClaimQuery({ mode: session.mode, role: session.role, accountKey: session.accountKey, path: `/v1/claims/${encodeURIComponent(claimId ?? "")}` }, { skip: !claimId });
  return <AppShell><DataState loading={query.isLoading || (query.isFetching && !query.currentData)} error={!claimId ? new Error("A claim reference is required.") : query.error} onRetry={query.refetch}>{query.currentData && <section className="surface welcome"><p className="eyebrow">{isSubmitted(query.currentData.status) ? "CLAIM RECEIVED" : "DRAFT CLAIM"}</p><PageHeader title={isSubmitted(query.currentData.status) ? "Your claim has been submitted" : "Your claim is still a draft"} description={isSubmitted(query.currentData.status) ? "Your current claim status is recorded. Follow the next action as the claim progresses." : "This claim has not been submitted for review. Resume your saved draft to finish."}/>{params.get("cleanup") === "failed" && <p className="alert" role="alert">Your claim was submitted, but some local draft data could not be cleared. Clear site storage when you finish using this browser.</p>}<dl className="detail-grid"><div className="full"><dt>Claim reference</dt><dd><code>{query.currentData.id}</code></dd></div></dl><p className="notice">{isSubmitted(query.currentData.status) ? "A submitted claim does not confirm a refund payment. Follow the claim status for the current outcome and next action." : "Resume your saved draft and finish adding evidence before submitting for review."}</p><div className="button-row"><Button variant="secondary" asChild><Link href="/claims">My claims</Link></Button>{!isSubmitted(query.currentData.status) && <Button variant="secondary" asChild><Link href="/claims/new/check">Resume saved draft</Link></Button>}<Button asChild><Link href={`/claims/detail?claimId=${encodeURIComponent(query.currentData.id)}`}>Track this claim</Link></Button></div></section>}</DataState></AppShell>;
}

export default function ReceivedPage() { return <Suspense fallback={<AppShell><section className="surface" role="status">Loading claim reference...</section></AppShell>}><Received/></Suspense>; }
