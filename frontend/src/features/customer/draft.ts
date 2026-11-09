import { EMPTY_DRAFT, type ClaimDraft, type EvidenceMetadata } from "@/lib/types";

export const CLAIM_TYPES = ["damaged_item", "wrong_item", "non_delivery", "delayed_delivery"];
export function validateDraft(draft: ClaimDraft): string | undefined {
  if (!draft.orderId.trim() || !/^[-A-Za-z0-9_]+$/.test(draft.orderId)) return "Enter a valid order reference.";
  if (!/^\d+(\.\d{1,2})?$/.test(draft.amount) || !Number.isFinite(Number(draft.amount)) || Number(draft.amount) < 0.01) return "Enter a refund amount of at least 0.01 with up to two decimal places.";
  if (!CLAIM_TYPES.includes(draft.claimType)) return "Choose an issue type.";
  if (draft.reason.trim().length < 10 || draft.reason.length > 2000) return "Explain what happened in 10 to 2,000 characters.";
}
export function parseDraft(saved: string | null): ClaimDraft {
  if (!saved) return { ...EMPTY_DRAFT, files: [] };
  const parsed = JSON.parse(saved) as Partial<ClaimDraft>;
  const validFile = (file: EvidenceMetadata) => file && typeof file.id === "string" && typeof file.name === "string" && typeof file.type === "string" && typeof file.status === "string" && Number.isFinite(file.size) && file.size > 0;
  if (!parsed || typeof parsed.orderId !== "string" || typeof parsed.claimType !== "string" || typeof parsed.amount !== "string" || typeof parsed.reason !== "string" || !Array.isArray(parsed.files) || parsed.files.length > 5 || !parsed.files.every(validFile) || (parsed.claimId !== undefined && typeof parsed.claimId !== "string") || (parsed.uploaded !== undefined && (!Array.isArray(parsed.uploaded) || !parsed.uploaded.every(id => typeof id === "string")))) throw new Error("The saved draft could not be recovered. Start a new draft or re-enter your claim details.");
  return { ...EMPTY_DRAFT, ...parsed } as ClaimDraft;
}
export function isSubmitted(status: string) { return !["draft", "uploading"].includes(status); }
