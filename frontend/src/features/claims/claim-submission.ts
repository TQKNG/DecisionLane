import type { ApiError } from "@/lib/api/base-query";
import type { ClaimSubmissionResponse, UploadGrant } from "@/features/claims/types";

export type UploadStage = "waiting" | "uploading" | "verifying" | "verified" | "failed";

export interface UploadProgress {
    stage: UploadStage;
    /** True once the Blob accepted the bytes, so a retry only repeats verification. */
    uploaded: boolean;
    grant?: UploadGrant;
    error?: string;
}

export type SubmissionPhase = "editing" | "creating" | "uploading" | "submitting" | "submitted" | "failed";
export type FailedStep = "create" | "upload" | "submit";

export interface SubmissionState {
    phase: SubmissionPhase;
    claimId?: string;
    uploads: Record<string, UploadProgress>;
    failedStep?: FailedStep;
    error?: ApiError;
    result?: ClaimSubmissionResponse;
}

export type SubmissionAction =
    | { type: "creating"; keys: string[] }
    | { type: "claim_created"; claimId: string }
    | { type: "uploads_started" }
    | { type: "upload_stage"; key: string; stage: UploadStage; grant?: UploadGrant; uploaded?: boolean; error?: string }
    | { type: "submitting" }
    | { type: "submitted"; result: ClaimSubmissionResponse }
    | { type: "failed"; step: FailedStep; error?: ApiError };

export const INITIAL_SUBMISSION: SubmissionState = { phase: "editing", uploads: {} };

export function claimSubmissionReducer(state: SubmissionState, action: SubmissionAction): SubmissionState {
    switch (action.type) {
        case "creating":
            return { phase: "creating", uploads: Object.fromEntries(action.keys.map((key) => [key, { stage: "waiting", uploaded: false }])) };
        case "claim_created":
            return { ...state, claimId: action.claimId };
        case "uploads_started":
            return { ...state, phase: "uploading", failedStep: undefined, error: undefined };
        case "upload_stage": {
            const current = state.uploads[action.key] ?? { stage: "waiting", uploaded: false };
            const next: UploadProgress = {
                stage: action.stage,
                uploaded: action.uploaded ?? current.uploaded,
                grant: action.grant ?? current.grant,
                error: action.stage === "failed" ? action.error : undefined,
            };
            return { ...state, uploads: { ...state.uploads, [action.key]: next } };
        }
        case "submitting":
            return { ...state, phase: "submitting", failedStep: undefined, error: undefined };
        case "submitted":
            return { ...state, phase: "submitted", result: action.result };
        case "failed":
            return { ...state, phase: "failed", failedStep: action.step, error: action.error };
    }
}

export function isSubmissionBusy(state: SubmissionState): boolean {
    return state.phase === "creating" || state.phase === "uploading" || state.phase === "submitting";
}

/** Counts the steps finished so far: one per verified file plus creating and submitting the claim. */
export function submissionProgress(state: SubmissionState): { completed: number; total: number } {
    const uploads = Object.values(state.uploads);
    const total = uploads.length + 2;
    const completed = (state.claimId ? 1 : 0) + uploads.filter((upload) => upload.stage === "verified").length + (state.phase === "submitted" ? 1 : 0);
    return { completed, total };
}
