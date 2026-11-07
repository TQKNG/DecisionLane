import Link from "next/link";

export interface ClaimRow{
    id:string;
    order_id:string;
    claim_type: string;
    requested_amount: string;
    currency:string;
    status:string;
    created_at:string;
    proposed_amount?: string;
    required_approval_count?: number;
}

export function ClaimsTable({ claims, reviewMode = false }: { claims: ClaimRow[]; reviewMode?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full text-left">
        <thead className="bg-slate-900 text-slate-300">
          <tr><th className="p-4">Claim ID</th><th>Order</th><th>Type</th><th>Requested</th>{reviewMode&&<><th>Proposed</th><th>Approvals</th></>}<th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="border-t border-slate-800">
              <td className="p-4 font-mono text-xs">{claim.id}</td>
              <td>{claim.order_id}</td><td>{claim.claim_type}</td>
              <td>CAD {Number(claim.requested_amount).toFixed(2)}</td>{reviewMode&&<><td>{claim.proposed_amount?`CAD ${Number(claim.proposed_amount).toFixed(2)}`:"Pending assessment"}</td><td>{claim.required_approval_count??(claim.proposed_amount?(Number(claim.proposed_amount)>500?2:1):"Pending")}</td></>}<td>{claim.status.replaceAll("_"," ")}</td>
              <td><Link className="text-cyan-400" href={reviewMode ? `/reviews/detail?claimId=${claim.id}` : `/claims/detail?claimId=${claim.id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
