"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClaimRow } from "@/components/claims-table";
import { useApi } from "@/lib/api";

export default function ClaimDetailPage() {
  return (
    <Suspense fallback={<AppShell><h1 className="text-3xl font-semibold">Claim status</h1></AppShell>}>
      <ClaimDetailContent />
    </Suspense>
  );
}

function ClaimDetailContent() {
  const states:Record<string,string>={draft:"Draft",uploading:"Uploading evidence",scanning:"Checking evidence",processing:"Processing",needs_information:"More information needed",pending_approval:"Awaiting human approval",approved:"Approved",rejected:"Rejected",refund_submitted:"Refund processing",refunded:"Refunded",refund_failed:"Refund failed",pending_ai_capacity:"Assessment capacity unavailable",closed:"Closed"};
  const explanations:Record<string,string>={draft:"Your claim has not been submitted.",uploading:"Evidence is being transferred securely.",scanning:"Evidence checks are in progress. A timeout does not mean your evidence is missing.",processing:"Your claim is being prepared for review.",needs_information:"Please follow the instructions from support to provide more information.",pending_approval:"A human reviewer is considering your claim.",approved:"Your claim was approved. The refund uses your original payment method.",rejected:"Your claim was not approved. Contact support if you need help.",refund_submitted:"The refund request was sent to the payment provider. Payment is not yet confirmed.",refunded:"The payment provider confirmed the refund to your original payment method.",refund_failed:"The payment provider could not complete the refund. Contact support for next steps.",pending_ai_capacity:"Assessment is waiting for available capacity. It will not restart automatically.",closed:"This claim is closed."};
  const { request } = useApi();
  const searchParams = useSearchParams();
  const claimId = searchParams.get("claimId");
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!claimId) {
      return;
    }
    request<ClaimRow>(`/v1/claims/${claimId}`).then(setClaim).catch((value) => setError(String(value)));
  }, [claimId, request]);
  const displayedError = error || (!claimId ? "We couldn't load this claim. Return to claims and open a claim you can access." : "");
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Claim status</h1>
      {displayedError && <section className="surface" role="alert"><p>{displayedError.startsWith("We couldn't")?displayedError:"We couldn't load this claim. Return to claims and open a claim you can access."}</p><a className="button secondary" href="/claims">Back to claims</a></section>}
      {claim && <section className="surface" style={{maxWidth:820}}><p className="status">Claim status</p><h1 className="page-title">{states[claim.status]??claim.status.replaceAll("_"," ")}</h1><p className="page-subtitle">{explanations[claim.status]??"Your claim status is being updated."}</p><dl className="detail-grid"><div className="detail-item"><dt className="detail-label">Claim reference</dt><dd>{claim.id}</dd></div><div className="detail-item"><dt className="detail-label">Order</dt><dd>{claim.order_id}</dd></div><div className="detail-item"><dt className="detail-label">Claim type</dt><dd>{claim.claim_type.replaceAll("_"," ")}</dd></div><div className="detail-item"><dt className="detail-label">Requested amount</dt><dd>CAD {Number(claim.requested_amount).toFixed(2)}</dd></div></dl><div className="timeline"><div>{states[claim.status]??claim.status}<p className="helper">{explanations[claim.status]??"Your claim status is being updated."}</p></div></div></section>}
    </AppShell>
  );
}
