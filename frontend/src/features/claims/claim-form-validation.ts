import { CLAIM_TYPES, type ClaimType } from "@/features/claims/types";

// Limits mirror backend/src/refundflow/services/blob_storage.py and the CreateClaimRequest schema.
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 5;
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 2000;
export const ORDER_ID_MAX_LENGTH = 100;
export const CLAIM_CURRENCY = "CAD";
export const EVIDENCE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

export type EvidenceContentType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export interface ClaimFormValues {
    orderId: string;
    claimType: ClaimType | "";
    requestedAmount: string;
    reason: string;
}

export type ClaimFormField = keyof ClaimFormValues | "evidence";
export type ClaimFormErrors = Partial<Record<ClaimFormField, string>>;

export const EMPTY_CLAIM_FORM: ClaimFormValues = { orderId: "", claimType: "", requestedAmount: "", reason: "" };

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function validateClaimForm(values: ClaimFormValues, evidenceCount: number): ClaimFormErrors {
    const errors: ClaimFormErrors = {};
    const orderId = values.orderId.trim();
    const reason = values.reason.trim();
    const amount = values.requestedAmount.trim();

    if (!orderId) errors.orderId = "Enter the order ID from your order confirmation.";
    else if (orderId.length > ORDER_ID_MAX_LENGTH) errors.orderId = `Order IDs are at most ${ORDER_ID_MAX_LENGTH} characters.`;

    if (!values.claimType || !(CLAIM_TYPES as readonly string[]).includes(values.claimType)) errors.claimType = "Choose what went wrong with the order.";

    if (!amount) errors.requestedAmount = "Enter the amount you want refunded.";
    else if (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) errors.requestedAmount = "Enter an amount greater than 0 with up to two decimal places.";

    if (reason.length < REASON_MIN_LENGTH) errors.reason = `Describe what happened in at least ${REASON_MIN_LENGTH} characters.`;
    else if (reason.length > REASON_MAX_LENGTH) errors.reason = `Keep the description under ${REASON_MAX_LENGTH} characters.`;

    if (evidenceCount < 1) errors.evidence = "Add at least one file that supports your claim.";
    else if (evidenceCount > MAX_EVIDENCE_FILES) errors.evidence = `Add at most ${MAX_EVIDENCE_FILES} files.`;

    return errors;
}

/** Detects the evidence type from the file's leading bytes so a renamed or mislabeled file is caught before upload. */
export function detectEvidenceContentType(bytes: Uint8Array): EvidenceContentType | undefined {
    const startsWith = (signature: number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value);
    if (startsWith([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
    if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
    return undefined;
}

export type EvidenceCheck = { ok: true; contentType: EvidenceContentType } | { ok: false; error: string };

export async function checkEvidenceFile(file: Blob & { name: string }): Promise<EvidenceCheck> {
    if (file.size === 0) return { ok: false, error: "The file is empty." };
    if (file.size > MAX_EVIDENCE_BYTES) return { ok: false, error: "The file is larger than 4 MB." };
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const contentType = detectEvidenceContentType(header);
    if (!contentType) return { ok: false, error: "Only PDF, JPEG, PNG, and WebP files are accepted." };
    return { ok: true, contentType };
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
