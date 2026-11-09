"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Claim } from "@/lib/types";
import { money, label } from "@/lib/types";
import { useSession } from "./providers";
import { useReviewQuery } from "@/lib/store";
import { StatusBadge } from "./claim-components";
export type ClaimRow = Claim;
export function ClaimsTable({ claims, reviewMode = false }: {
    claims: Claim[];
    reviewMode?: boolean;
}) { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []); return <div className="table-wrap"><table className="data-table"><caption className="visually-hidden">Refund claims</caption><thead><tr><th scope="col">Claim / order</th><th scope="col">Issue</th><th scope="col">Age</th><th scope="col">Requested</th><th scope="col">Status</th>{reviewMode && <th scope="col">Approval progress</th>}<th scope="col">Action</th></tr></thead><tbody>{claims.map(claim => <tr key={claim.id}><td><strong>{claim.id}</strong><br /><span className="helper">{claim.order_id}</span></td><td>{label(claim.claim_type)}</td><td>{Math.max(0, Math.floor((now - Date.parse(claim.created_at)) / 86400000))}d</td><td>{money(claim.requested_amount, claim.currency)}</td><td><StatusBadge status={claim.status}/></td>{reviewMode && <td className="helper"><QueueApproval claim={claim}/></td>}<td><Link className="text-link" href={`${reviewMode ? "/reviews" : "/claims"}/detail?claimId=${encodeURIComponent(claim.id)}`}>View<span className="visually-hidden"> {claim.id}</span> →</Link></td></tr>)}</tbody></table></div>; }

function QueueApproval({ claim }: { claim: Claim }) {
    const { mode, role, accountKey, authenticated } = useSession();
    const assessmentReady = ["pending_approval", "approved", "rejected", "refund_submitted", "refunded", "refund_failed"].includes(claim.status);
    const review = useReviewQuery({ mode, role, accountKey, path: `/v1/reviews/${encodeURIComponent(claim.id)}` }, { skip: !authenticated || role === "Customer" || !assessmentReady });
    if (!assessmentReady) return <>Assessment pending</>;
    if (review.isLoading) return <span role="status">Loading approvals...</span>;
    if (!review.currentData) return <>Open assessment for progress</>;
    const required = review.currentData.assessment.requires_two_reviewers ? 2 : 1;
    const count = review.currentData.approvals.filter(approval => approval.decision === "approve").length;
    return <>{count} of {required} approved</>;
}
