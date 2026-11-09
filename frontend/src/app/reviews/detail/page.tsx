"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActivityTimeline, ApprovalProgress, AssessmentCriterion, ClaimSummary, DataState, PageHeader, StatusBadge } from "@/components/claim-components";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { money } from "@/lib/types";
import { useActionMutation, useReviewQuery } from "@/lib/store";

type DemoPreview = { id: string; kind: "receipt" | "photo" } | null;

function paymentState(status: string) {
  if (status === "refunded") return "Refund confirmed";
  if (status === "refund_submitted") return "Refund processing";
  if (status === "refund_failed") return "Refund failed - requires operations follow-up";
  if (status === "approved") return "Approved - payment has not been submitted";
  return "No payment action recorded";
}

function ReviewContent() {
  const params = useSearchParams();
  const session = useSession();
  const claimId = params.get("claimId") ?? "";
  const [rationale, setRationale] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [preview, setPreview] = useState<DemoPreview>(null);
  const [message, setMessage] = useState("");
  const reviewResult = useReviewQuery(
    { mode: session.mode, role: session.role, accountKey: session.accountKey, path: `/v1/reviews/${encodeURIComponent(claimId)}` },
    { skip: !claimId || session.role === "Customer", pollingInterval: 15_000 },
  );
  const [act, actionResult] = useActionMutation();
  const review = reviewResult.currentData;
  const requiredApprovals = review?.assessment.requires_two_reviewers ? 2 : 1;
  const hasSources = Boolean(review?.assessment.criteria.length && review.assessment.criteria.every(criterion => criterion.citations.some(citation => citation.quote.trim() && citation.policy_version.trim())));
  const alreadyDecided = Boolean(review?.approvals.some(approval => approval.reviewer_id === session.userId));
  const canDecide = Boolean(review && review.claim.status === "pending_approval" && !alreadyDecided && rationale.trim().length >= 3 && rationale.trim().length <= 2000 && !actionResult.isLoading);
  const evidenceIds = useMemo(() => [...new Set(review?.assessment.criteria.flatMap(criterion => criterion.evidence_document_ids) ?? [])], [review]);
  const citations = useMemo(() => {
    const seen = new Set<string>();
    return (review?.assessment.criteria.flatMap(criterion => criterion.citations) ?? []).filter(citation => {
      const key = `${citation.policy_id}:${citation.policy_version}:${citation.chunk_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [review]);
  const closeDecision = (open: boolean) => { if (!open && !actionResult.isLoading) setDecision(null); };

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!decision || !review || !canDecide || (decision === "approve" && !hasSources)) return;
    setMessage("");
    try {
      await act({ mode: session.mode, role: session.role, accountKey: session.accountKey, path: `/v1/reviews/${encodeURIComponent(claimId)}/decision`, init: { method: "POST", body: JSON.stringify({ decision, comment: rationale.trim() }) } }).unwrap();
      await reviewResult.refetch();
      setMessage(decision === "approve" ? "Approval recorded. The claim and payment state above remain authoritative." : "Rejection recorded. The claim state above has been refreshed.");
      setDecision(null);
      setRationale("");
    } catch (error) {
      const detail = typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
      setMessage(`${detail} Refresh the assessment before retrying.`);
    }
  }

  if (session.role === "Customer") return <section className="surface" role="alert"><h1 className="section-title">Reviewer access required</h1><p className="helper">This claim assessment is restricted to staff.</p></section>;
  if (!claimId) return <section className="error-summary" role="alert"><h1 className="section-title">Choose a claim to review</h1><p>Open a claim from the review queue to inspect its assessment.</p></section>;

  return <DataState loading={reviewResult.isLoading || (reviewResult.isFetching && !review)} error={reviewResult.error} onRetry={reviewResult.refetch}>{review && <>
    <PageHeader title={`Review ${review.claim.id}`} description={`${review.claim.order_id} · Submitted ${new Date(review.claim.created_at).toLocaleDateString("en-CA")}`} />
    {session.mode === "demo" && <p className="notice">Demo assessment and evidence previews are synthetic. They do not represent a live evidence-preview service.</p>}
    {message && <p className="surface" role="status" aria-live="polite">{message}</p>}
    <div className="review-grid"><section className="surface review-workspace">
      <div className="page-header"><div><p className="eyebrow">AI-ASSISTED ASSESSMENT</p><h2 className="section-title">{review.assessment.eligible ? "Assessment supports eligibility" : "Assessment needs review"}</h2></div><StatusBadge status={review.claim.status} /></div>
      <p>{review.assessment.summary}</p>
      <dl className="detail-grid"><div><dt>Requested</dt><dd>{money(review.claim.requested_amount, review.claim.currency)}</dd></div><div><dt>Proposed</dt><dd>{money(review.assessment.proposed_refund_amount, review.claim.currency)}</dd></div><div><dt>Assessment confidence</dt><dd>{Math.round(review.assessment.confidence * 100)}%</dd></div><div><dt>Payment state</dt><dd>{paymentState(review.claim.status)}</dd></div></dl>
      <p className="helper">Assessment is advisory. A human reviewer records the decision after inspecting the source passages.</p>
      {review.assessment.criteria.map(criterion => <AssessmentCriterion key={criterion.name} criterion={criterion} />)}
      {!hasSources && <p className="alert">Approval is disabled because a policy citation is missing its supporting passage or version. Confirm the authoritative policy source first.</p>}
      {alreadyDecided && <p className="notice">You have already recorded a decision. A distinct reviewer identity is required for another approval.</p>}
      {review.claim.status !== "pending_approval" && <p className="notice">This claim is not awaiting a reviewer decision. Its current status is authoritative.</p>}
      <form onSubmit={event => { event.preventDefault(); if (canDecide && hasSources) setDecision("approve"); }}><label className="field">Reviewer rationale<textarea required minLength={3} maxLength={2000} value={rationale} onChange={event => setRationale(event.target.value)} placeholder="Explain the evidence and policy basis for your decision." /></label><div className="button-row"><Button type="button" variant="destructive" disabled={!canDecide} onClick={() => setDecision("reject")}>Reject claim</Button><Button disabled={!canDecide || !hasSources}>Record approval</Button></div></form>
    </section><aside className="surface"><h2 className="section-title">Case context</h2><ClaimSummary claim={review.claim} /><h3 className="section-title" style={{ marginTop: 24 }}>Approval history</h3><ApprovalProgress approvals={review.approvals} required={requiredApprovals} />{review.approvals.length ? <ActivityTimeline items={review.approvals.map(approval => ({ title: `${approval.reviewer_name} ${approval.decision === "approve" ? "approved" : "rejected"}`, description: approval.comment }))} /> : <p className="helper">No decisions have been recorded.</p>}<h3 className="section-title" style={{ marginTop: 24 }}>Evidence</h3>{evidenceIds.length ? <ul className="file-list">{evidenceIds.map((id, index) => <li className="file-row" key={id}><span><strong>{id}</strong><br /><span className="helper">{session.mode === "demo" ? "Synthetic evidence reference" : "Reference supplied by the assessment"}</span></span>{session.mode === "demo" && <Button variant="secondary" type="button" onClick={() => setPreview({ id, kind: index % 2 ? "photo" : "receipt" })}>Preview</Button>}</li>)}</ul> : <p className="helper">No evidence references were returned with this assessment.</p>}<h3 className="section-title" style={{ marginTop: 24 }}>Policy sources</h3>{citations.map(source => <details key={`${source.policy_id}:${source.policy_version}:${source.chunk_id}`}><summary>{source.title} · {source.policy_version}</summary><blockquote>{source.quote}</blockquote><p className="helper">Source: {source.chunk_id}</p></details>)}</aside></div>
    <Dialog open={Boolean(decision)} onOpenChange={closeDecision}><DialogContent><DialogTitle>Confirm {decision === "approve" ? "approval" : "rejection"}</DialogTitle><DialogDescription>This will record your rationale in the review history.</DialogDescription><form onSubmit={confirm}><p>{decision === "approve" && requiredApprovals === 2 ? "Two distinct reviewers are required. This approval does not submit a payment." : "The workflow will determine the authoritative next claim state."}</p><div className="button-row"><Button variant="secondary" type="button" disabled={actionResult.isLoading} onClick={() => setDecision(null)}>Go back</Button><Button variant={decision === "reject" ? "destructive" : "default"} disabled={!canDecide || (decision === "approve" && !hasSources)}>{actionResult.isLoading ? "Recording..." : `Confirm ${decision}`}</Button></div></form></DialogContent></Dialog>
    <Dialog open={Boolean(preview)} onOpenChange={open => !open && setPreview(null)}><DialogContent><DialogTitle>Synthetic {preview?.kind === "receipt" ? "receipt" : "photo evidence"}</DialogTitle><DialogDescription>Demo-only evidence preview for {preview?.id}. It is not fetched from a live service.</DialogDescription>{preview?.kind === "receipt" ? <section className="surface"><p><strong>Order confirmation</strong></p><p>Order: {review.claim.order_id}</p><p>Claim reference: {review.claim.id}</p><p>Amount: {money(review.claim.requested_amount, review.claim.currency)}</p><p className="helper">Synthetic receipt generated for the demo scenario.</p></section> : <section className="surface"><div aria-label="Synthetic item photo evidence" style={{ aspectRatio: "4 / 3", background: "linear-gradient(135deg, #dbeafe, #f5f5f5)", display: "grid", placeItems: "center", borderRadius: 6 }}><svg viewBox="0 0 320 240" role="img" aria-label="Synthetic parcel with a damaged corner" style={{width:"100%",maxHeight:240}}><rect width="320" height="240" fill="#f5f5f5"/><path d="M70 80 L190 50 L260 100 L140 132 Z" fill="#d5b68c" stroke="#785b39" strokeWidth="2"/><path d="M70 80 L140 132 L140 210 L70 160 Z" fill="#ba9563" stroke="#785b39" strokeWidth="2"/><path d="M140 132 L260 100 L260 178 L140 210 Z" fill="#dfc49e" stroke="#785b39" strokeWidth="2"/><path d="M230 107 L240 128 L226 143 L250 154 L235 185" fill="none" stroke="#991b1b" strokeWidth="4"/><text x="20" y="225" fontFamily="Arial" fontSize="12" fill="#525252">Demo evidence: damaged parcel corner</text></svg></div><p className="helper">Synthetic illustration of the reported parcel damage for inspection.</p></section>}<div className="button-row"><Button type="button" onClick={() => setPreview(null)}>Close preview</Button></div></DialogContent></Dialog>
  </>}</DataState>;
}

export default function ReviewDetailPage() { return <AppShell><Suspense fallback={<section className="surface" role="status">Loading assessment...</section>}><ReviewContent /></Suspense></AppShell>; }
