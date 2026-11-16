import { DataTable } from "@/components/ui/data-table";
import { ClaimStatusBadge } from "@/features/claims/claim-status-badge";
import { formatAmount, formatClaimType, formatDateTime } from "@/features/claims/format";
import type { RefundClaim } from "@/features/claims/types";

/** Lists claims as a table on wide screens and as stacked cards on narrow screens. */
export function ClaimsTable({ claims }: { claims: readonly RefundClaim[] }) {
    return <>
        <DataTable className="dl-claims-table" aria-label="Your refund claims">
            <thead><tr><th scope="col">Claim</th><th scope="col">Order</th><th scope="col">Reason</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead>
            <tbody>
                {claims.map((claim) => <tr key={claim.id}>
                    <th scope="row" className="dl-claims-id">{claim.id}</th>
                    <td className="dl-claims-muted">{claim.order_id}</td>
                    <td>{formatClaimType(claim.claim_type)}</td>
                    <td>{formatAmount(claim.requested_amount, claim.currency)}</td>
                    <td><ClaimStatusBadge status={claim.status} /></td>
                    <td className="dl-claims-muted"><time dateTime={claim.updated_at}>{formatDateTime(claim.updated_at)}</time></td>
                </tr>)}
            </tbody>
        </DataTable>
        <ul className="dl-claims-cards" aria-label="Your refund claims">
            {claims.map((claim) => <li key={claim.id} className="dl-card dl-claims-card">
                <div className="dl-claims-card-head"><span className="dl-claims-id">{claim.id}</span><ClaimStatusBadge status={claim.status} /></div>
                <dl>
                    <div><dt>Order</dt><dd>{claim.order_id}</dd></div>
                    <div><dt>Reason</dt><dd>{formatClaimType(claim.claim_type)}</dd></div>
                    <div><dt>Amount</dt><dd>{formatAmount(claim.requested_amount, claim.currency)}</dd></div>
                    <div><dt>Updated</dt><dd><time dateTime={claim.updated_at}>{formatDateTime(claim.updated_at)}</time></dd></div>
                </dl>
            </li>)}
        </ul>
    </>;
}
