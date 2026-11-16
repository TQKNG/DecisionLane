"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/lib/store";
import type { ClaimFormValues } from "@/features/claims/claim-form-validation";
import { claimSubmissionReducer, INITIAL_SUBMISSION, isSubmissionBusy, type SubmissionAction } from "@/features/claims/claim-submission";
import { runClaimSubmission, type EvidenceFile } from "@/features/claims/claim-submission-runner";

export type { EvidenceFile } from "@/features/claims/claim-submission-runner";

/** Holds submission state for one claim form and runs the create, upload, verify, and submit steps. */
export function useClaimSubmission() {
    const dispatch = useDispatch<AppDispatch>();
    const [state, setState] = useState(INITIAL_SUBMISSION);
    const stateRef = useRef(state);
    const apply = useCallback((action: SubmissionAction) => {
        stateRef.current = claimSubmissionReducer(stateRef.current, action);
        setState(stateRef.current);
    }, []);

    const submit = useCallback((values: ClaimFormValues, evidence: readonly EvidenceFile[]) => runClaimSubmission({ dispatch, apply, getState: () => stateRef.current }, values, evidence), [apply, dispatch]);
    // Warn before leaving while work is in flight or a created claim is not yet submitted.
    const unsaved = isSubmissionBusy(state) || (Boolean(state.claimId) && state.phase !== "submitted");
    useEffect(() => {
        if (!unsaved) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [unsaved]);

    return { state, submit };
}
