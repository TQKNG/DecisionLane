"use client";

import Link from "next/link";
import { type FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ActivityTimeline, ClaimSummary, DataState, PageHeader, StatusBadge } from "@/components/claim-components";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { useActionMutation, useClaimQuery } from "@/lib/store";

const STATUS_CONTENT: Record<string, { title: string; next: string; tone?: string }> = {
  draft: { title: "Draft claim", next: "Finish the evidence and submit your claim." },
  uploading: { title: "Evidence upload in progress", next: "Keep this page open while your evidence is transferred." },
  scanning: { title: "Checking evidence", next: "We are checking the evidence you submitted." },
  processing: { title: "Claim is being assessed", next: "We are preparing your claim for human review." },
  needs_information: { title: "We need more information", next: "Read the request and provide the missing detail." },
  pending_approval: { title: "Awaiting human approval", next: "A reviewer is considering the evidence and policy." },
  approved: { title: "Claim approved", next: "Approval is separate from payment confirmation." },
  rejected: { title: "Claim not approved", next: "The decision is recorded on this claim." },
  refund_submitted: { title: "Refund processing", next: "The refund request was sent to the payment provider. Payment is not yet confirmed." },
  refunded: { title: "Refund confirmed", next: "The payment provider confirmed the refund to your original payment method.", tone: "success" },
  refund_failed: { title: "Refund could not be completed", next: "Contact support with your claim reference so the payment issue can be resolved.", tone: "danger" },
  pending_ai_capacity: { title: "Assessment is waiting", next: "Assessment capacity is currently unavailable. Check back for an update." },
  closed: { title: "Claim closed", next: "This claim no longer has an open action." },
};

function ClaimDetail() {
  const params = useSearchParams();
  const session = useSession();
  const [action, actionResult] = useActionMutation();
  const [response, setResponse] = useState("");
  const [message, setMessage] = useState("");
  const claimId = params.get("claimId");
  const args = useMemo(() => claimId ? { mode: session.mode, role: session.role, accountKey: session.accountKey, path: `/v1/claims/${encodeURIComponent(claimId)}` } : null, [claimId, session.accountKey, session.mode, session.role]);
  const query = useClaimQuery(args!, { skip: !args, pollingInterval: 15000, refetchOnFocus: true });
  const claim = query.currentData;
  const content = claim ? STATUS_CONTENT[claim.status] ?? { title: "Claim status updated", next: "Check this claim again for its next action." } : null;

  async function respond(event: FormEvent) {
    event.preventDefault();
    if (actionResult.isLoading || !claim || claim.status !== "needs_information" || session.mode !== "demo" || session.role !== "Customer") return;
    if (response.trim().length < 10 || response.trim().length > 2000) { setMessage("Provide 10 to 2,000 characters so the request can be reviewed."); return; }
    try {
      setMessage("Sending your response...");
      await action({ mode: session.mode, role: session.role, accountKey: session.accountKey, path: `/demo/claims/${claim.id}/information`, init: { method: "POST", body: JSON.stringify({ response: response.trim() }) } }).unwrap();
      setMessage("Your demo response was recorded. The claim is now processing.");
      setResponse(""); query.refetch();
    } catch (error) { setMessage(typeof error === "object" && error && "message" in error ? String(error.message) : "We could not record your response."); }
  }

  return <AppShell><PageHeader title="Claim details" description={claimId ? `Reference ${claimId}` : "Open a claim from your dashboard."}/><DataState loading={query.isLoading || (query.isFetching && !query.currentData)} error={!claimId ? new Error("Choose a claim from My claims to view its details.") : query.error} onRetry={query.refetch}>{claim && content && <><section className="surface"><StatusBadge status={claim.status}/><h2 className="section-title" style={{ marginTop: 16 }}>{content.title}</h2><p className="page-subtitle">{content.next}</p><ClaimSummary claim={claim}/></section>
    {claim.status === "needs_information" && <section className="surface"><h2 className="section-title">Information request</h2><p className="helper">The live service does not yet provide a response endpoint. {session.mode === "demo" && session.role === "Customer" ? "You can simulate a response in this demo." : "Use the support instructions associated with your claim reference."}</p>{session.mode === "demo" && session.role === "Customer" && <form onSubmit={respond}><label className="field">Your response<textarea minLength={10} maxLength={2000} required value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Add the requested order or delivery details."/></label><div className="button-row"><Button disabled={actionResult.isLoading}>Send demo response</Button></div></form>}</section>}
    {message && <p className="notice" role="status">{message}</p>}
    <section className="surface"><h2 className="section-title">Evidence</h2><p className="helper">{session.mode === "demo" ? "Synthetic demo evidence is used for this claim. Inspectable evidence previews are available while you are preparing a new claim." : "The current live claim contract does not return evidence documents or previews. The current status above remains authoritative."}</p></section>
    <section className="surface"><h2 className="section-title">Recorded activity</h2><ActivityTimeline items={session.mode === "demo" ? [{ title: "Claim created", description: "Your synthetic claim was created.", date: claim.created_at }, { title: content.title, description: content.next, date: claim.updated_at }] : [{ title: content.title, description: "The live service provides the current authoritative status.", date: claim.updated_at }]}/></section>
    <div className="button-row"><Button variant="secondary" asChild><Link href="/claims">Back to claims</Link></Button></div></>}</DataState></AppShell>;
}

export default function ClaimDetailPage() { return <Suspense fallback={<AppShell><section className="surface" role="status">Loading claim details...</section></AppShell>}><ClaimDetail/></Suspense>; }
