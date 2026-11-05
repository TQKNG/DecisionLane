"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { useApi } from "@/lib/api";

interface Criterion {
  name: string;
  status: string;
  explanation: string;
  citations: Array<{ chunk_id: string; title: string; quote: string }>;
}

interface ReviewDetail {
  claim: { id: string; order_id: string; requested_amount: string; currency: string };
  assessment: { summary: string; proposed_refund_amount: string; confidence: number; criteria: Criterion[] };
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<AppShell><p>Loading assessment...</p></AppShell>}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const { request } = useApi();
  const searchParams = useSearchParams();
  const claimId = searchParams.get("claimId") ?? "";
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (claimId) request<ReviewDetail>(`/v1/reviews/${claimId}`).then(setReview);
  }, [claimId, request]);

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await request(`/v1/reviews/${claimId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision: formData.get("decision"), comment: formData.get("comment") }),
    });
    setMessage("Decision accepted.");
  }

  return (
    <AppShell>
      {!review ? <p>Loading assessment...</p> : <>
        <h1 className="text-3xl font-semibold">Review claim {review.claim.id}</h1>
        <p className="mt-3 text-slate-300">{review.assessment.summary}</p>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left"><thead><tr><th className="p-4">Criterion</th><th>Status</th><th>Explanation</th><th>Citations</th></tr></thead>
            <tbody>{review.assessment.criteria.map((criterion) => <tr key={criterion.name} className="border-t border-slate-800 align-top">
              <td className="p-4 font-medium">{criterion.name}</td><td>{criterion.status}</td><td className="max-w-md pr-4">{criterion.explanation}</td>
              <td className="max-w-md pr-4">{criterion.citations.map((citation) => <details key={citation.chunk_id}><summary>{citation.title}</summary><p className="text-sm text-slate-300">{citation.quote}</p></details>)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <form onSubmit={decide} className="mt-8 grid max-w-xl gap-4">
          <textarea required minLength={3} name="comment" placeholder="Explain the decision" className="min-h-28 rounded-lg bg-slate-800 p-3" />
          <div className="flex gap-3">
            <button name="decision" value="approve" className="rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950">Approve</button>
            <button name="decision" value="reject" className="rounded-lg bg-rose-400 px-5 py-3 font-semibold text-slate-950">Reject</button>
          </div>
          <p role="status">{message}</p>
        </form>
      </>}
    </AppShell>
  );
}