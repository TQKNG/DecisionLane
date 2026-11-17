import { isApiError, type ApiError } from "@/lib/api/base-query";
import type { AppDispatch } from "@/lib/store";
import { claimsApi } from "@/features/claims/api";
import { uploadEvidenceToBlob } from "@/features/claims/blob-upload";
import { CLAIM_CURRENCY, type ClaimFormValues, type EvidenceContentType } from "@/features/claims/claim-form-validation";
import { isSubmissionBusy, type SubmissionAction, type SubmissionState } from "@/features/claims/claim-submission";
import type { ClaimType } from "@/features/claims/types";

export interface EvidenceFile {
    key: string;
    file: File;
    contentType: EvidenceContentType;
}

export interface SubmissionRunner {
    dispatch: AppDispatch;
    getState: () => SubmissionState;
    apply: (action: SubmissionAction) => void;
    uploadToBlob?: typeof uploadEvidenceToBlob;
}

const SESSION_ERROR_KINDS = new Set<ApiError["kind"]>(["unauthorized", "forbidden", "not_configured"]);

function messageFrom(cause: unknown): string {
    if (isApiError(cause)) return cause.detail;
    if (cause instanceof Error) return cause.message;
    return "Something went wrong. Please try again.";
}

/**
 * Creates the claim, uploads and verifies each file, then submits.
 * A retry reuses the created claim and any upload grants, so it never creates a second claim.
 */
export async function runClaimSubmission({ dispatch, getState, apply, uploadToBlob = uploadEvidenceToBlob }: SubmissionRunner, values: ClaimFormValues, evidence: readonly EvidenceFile[]): Promise<void> {
    const current = getState();
    if (isSubmissionBusy(current) || current.phase === "submitted") return;

    let claimId = current.claimId;
    if (!claimId) {
        apply({ type: "creating", keys: evidence.map((item) => item.key) });
        try {
            const claim = await dispatch(claimsApi.endpoints.createClaim.initiate({
                order_id: values.orderId.trim(),
                claim_type: values.claimType as ClaimType,
                reason: values.reason.trim(),
                requested_amount: values.requestedAmount.trim(),
                currency: CLAIM_CURRENCY,
            }, { track: false })).unwrap();
            claimId = claim.id;
            apply({ type: "claim_created", claimId });
        } catch (cause) {
            apply({ type: "failed", step: "create", error: isApiError(cause) ? cause : undefined });
            return;
        }
    }

    apply({ type: "uploads_started" });
    let sessionError: ApiError | undefined;
    for (const item of evidence) {
        const progress = getState().uploads[item.key];
        if (progress?.stage === "verified") continue;
        try {
            let grant = progress?.grant;
            if (!progress?.uploaded) {
                apply({ type: "upload_stage", key: item.key, stage: "uploading" });
                grant ??= await dispatch(claimsApi.endpoints.requestUpload.initiate({ claimId, upload: { file_name: item.file.name, content_type: item.contentType, size_bytes: item.file.size } }, { track: false })).unwrap();
                apply({ type: "upload_stage", key: item.key, stage: "uploading", grant });
                await uploadToBlob(grant, item.file);
                apply({ type: "upload_stage", key: item.key, stage: "verifying", uploaded: true });
            } else {
                apply({ type: "upload_stage", key: item.key, stage: "verifying" });
            }
            if (!grant) throw new Error("The upload could not be verified. Please try again.");
            await dispatch(claimsApi.endpoints.completeUpload.initiate({ claimId, documentId: grant.document_id }, { track: false })).unwrap();
            apply({ type: "upload_stage", key: item.key, stage: "verified" });
        } catch (cause) {
            apply({ type: "upload_stage", key: item.key, stage: "failed", error: messageFrom(cause) });
            if (isApiError(cause) && SESSION_ERROR_KINDS.has(cause.kind)) {
                sessionError = cause;
                break;
            }
        }
    }
    if (sessionError || Object.values(getState().uploads).some((upload) => upload.stage !== "verified")) {
        apply({ type: "failed", step: "upload", error: sessionError });
        return;
    }

    apply({ type: "submitting" });
    try {
        const result = await dispatch(claimsApi.endpoints.submitClaim.initiate({ claimId }, { track: false })).unwrap();
        apply({ type: "submitted", result });
    } catch (cause) {
        apply({ type: "failed", step: "submit", error: isApiError(cause) ? cause : undefined });
    }
}
