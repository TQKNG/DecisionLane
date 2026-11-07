"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ClaimRow } from "@/components/claims-table";
import { useApi } from "@/lib/api";

export default function ClaimsPage() {
  const { request } = useApi();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    request<ClaimRow[]>("/v1/claims").then(setClaims).catch((value) => setError(String(value)));
  }, [request]);
  return <AppShell><div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:16}}><div><h1 className="page-title">My claims</h1><p className="page-subtitle">Follow the status of your refund claims.</p></div><a className="button" href="/claims/new/issue">New refund claim</a></div>{error ? <section className="surface" role="alert"><h2 className="section-title">Claims are unavailable</h2><p>{error}</p><button className="button secondary" onClick={()=>request<ClaimRow[]>("/v1/claims").then(setClaims).catch(value=>setError(String(value)))}>Try again</button></section> : claims.length===0?<><section className="surface empty"><h2 className="section-title">No claims yet</h2><p className="helper">Your submitted claims will appear here. Start with an order and describe what went wrong.</p></section><section className="surface"><h2 className="section-title">How it works</h2><p className="helper">Submit order details and evidence, then follow each status update. Every refund decision is reviewed by a person.</p></section></>:<div className="claims-list">{claims.map(claim=><a key={claim.id} className="claim-card" href={`/claims/detail?claimId=${encodeURIComponent(claim.id)}`}><div><h2>{claim.id} · {claim.order_id}</h2><p>{claim.claim_type.replaceAll("_"," ")} · Requested CAD {Number(claim.requested_amount).toFixed(2)}</p></div><span className="status">{claim.status.replaceAll("_"," ")}</span></a>)}</div>}</AppShell>;
}
