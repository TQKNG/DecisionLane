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
  const displayedError = error || (!claimId ? "Missing claim identifier" : "");
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Claim status</h1>
      {displayedError && <p className="mt-4 text-rose-300">{displayedError}</p>}
      {claim && <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-4 rounded-2xl border border-slate-800 p-6">
        <dt className="text-slate-400">Claim ID</dt><dd className="font-mono text-sm">{claim.id}</dd>
        <dt className="text-slate-400">Order</dt><dd>{claim.order_id}</dd>
        <dt className="text-slate-400">Type</dt><dd>{claim.claim_type}</dd>
        <dt className="text-slate-400">Requested</dt><dd>{claim.requested_amount} {claim.currency}</dd>
        <dt className="text-slate-400">Status</dt><dd className="font-semibold text-cyan-300">{claim.status}</dd>
      </dl>}
    </AppShell>
  );
}