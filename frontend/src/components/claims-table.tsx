import Link from "next/link";

export interface ClaimRow{
    id:string;
    order_id:string;
    claim_type: string;
    requested_amount: string;
    currency:string;
    status:string;
    created_at:string;
}

export function ClaimsTable({ claims, reviewMode = false }: { claims: ClaimRow[]; reviewMode?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full text-left">
        <thead className="bg-slate-900 text-slate-300">
          <tr><th className="p-4">Claim</th><th>Order</th><th>Type</th><th>Amount</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="border-t border-slate-800">
              <td className="p-4 font-mono text-xs">{claim.id}</td>
              <td>{claim.order_id}</td><td>{claim.claim_type}</td>
              <td>{claim.requested_amount} {claim.currency}</td><td>{claim.status}</td>
              <td><Link className="text-cyan-400" href={reviewMode ? `/reviews/detail?claimId=${claim.id}` : `/claims/detail?claimId=${claim.id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}