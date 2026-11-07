"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
function Received(){const params=useSearchParams();const id=params.get("claimId");return <AppShell><section className="surface" style={{maxWidth:760}}><p className="status good">Claim received</p><h1 className="page-title">Your claim is in review</h1><p className="page-subtitle">A reviewer will assess your information and evidence. We’ll update your claim status when there’s progress.</p><div className="detail-item"><dt className="detail-label">Reference</dt><dd style={{fontFamily:"monospace"}}>{id||"Reference unavailable"}</dd></div><div className="button-row"><Link className="button secondary" href="/claims">My claims</Link>{id&&<Link className="button" href={`/claims/detail?claimId=${encodeURIComponent(id)}`}>View status</Link>}</div></section></AppShell>}
export default function ReceivedPage(){return <Suspense fallback={<AppShell><p>Loading claim reference…</p></AppShell>}><Received/></Suspense>}
