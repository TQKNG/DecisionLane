export type Role = "Customer" | "Reviewer" | "Admin";
export interface Claim { id:string; customer_id:string; customer_email:string; order_id:string; claim_type:string; reason:string; requested_amount:string; currency:string; status:string; created_at:string; updated_at:string; }
export interface Citation { policy_id:string; policy_version:string; chunk_id:string; title:string; quote:string; }
export interface Criterion { name:string; status:string; explanation:string; evidence_document_ids:string[]; citations:Citation[]; }
export interface Approval { claim_id:string; reviewer_id:string; reviewer_name:string; decision:string; comment:string; }
export interface Assessment { claim_id:string; eligible:boolean; proposed_refund_amount:string; confidence:number; requires_two_reviewers:boolean; summary:string; criteria:Criterion[]; policy_snapshot_id:string; }
export interface ReviewDetail { claim:Claim; assessment:Assessment; approvals:Approval[]; }
export interface Kpis { total_claims:number; pending_approval:number; refunded:number; rejected:number; decision_rate:number; by_status:Record<string,number>; }
export interface EvidenceMetadata { id:string; name:string; size:number; type:string; status:string; }
export interface ClaimDraft { orderId:string; claimType:string; amount:string; reason:string; files:EvidenceMetadata[]; claimId?:string; uploaded?:string[]; grants?:Record<string,{document_id:string;upload_url:string;required_headers:Record<string,string>}>; }
export const EMPTY_DRAFT:ClaimDraft = {orderId:"",claimType:"damaged_item",amount:"",reason:"",files:[]};
export function money(value:string|number,currency="CAD") { return new Intl.NumberFormat("en-CA",{style:"currency",currency}).format(Number(value)); }
export function label(value:string) { return value.replaceAll("_"," ").replace(/^./,s=>s.toUpperCase()); }
