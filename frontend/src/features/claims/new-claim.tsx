"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiErrorState } from "@/components/api-error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { Notice } from "@/components/ui/notice";
import { ProgressBar } from "@/components/ui/progress-bar";
import { checkEvidenceFile, CLAIM_CURRENCY, EMPTY_CLAIM_FORM, EVIDENCE_ACCEPT, MAX_EVIDENCE_FILES, REASON_MAX_LENGTH, validateClaimForm, type ClaimFormErrors, type ClaimFormField, type ClaimFormValues } from "@/features/claims/claim-form-validation";
import { isSubmissionBusy, submissionProgress, type SubmissionState } from "@/features/claims/claim-submission";
import { EvidenceList } from "@/features/claims/evidence-list";
import { CLAIM_TYPE_LABELS } from "@/features/claims/format";
import { SubmissionResult } from "@/features/claims/submission-result";
import { CLAIM_TYPES } from "@/features/claims/types";
import { useClaimSubmission, type EvidenceFile } from "@/features/claims/use-claim-submission";
import styles from "./new-claim.module.css";

const CLAIM_TYPE_OPTIONS = CLAIM_TYPES.map((value) => ({ value, label: CLAIM_TYPE_LABELS[value] }));
const FIELD_IDS: Record<ClaimFormField, string> = { orderId: "claim-order-id", claimType: "claim-type", requestedAmount: "claim-amount", reason: "claim-reason", evidence: "claim-evidence" };
const SESSION_ERROR_KINDS = new Set(["unauthorized", "forbidden", "not_configured"]);
const NEXT_STEPS = [
    ["We check your evidence", "Files are scanned for safety and readability."],
    ["We assess your claim", "Your claim is compared with the refund policy."],
    ["A reviewer confirms", "A person reviews the assessment before any decision."],
    ["You get your refund", "Approved refunds go back to your original payment method."],
] as const;

interface RejectedFile {
    name: string;
    reason: string;
}

function evidenceKey(file: File) {
    return `${file.name}:${file.size}:${file.lastModified}`;
}

function statusMessage(state: SubmissionState): string {
    if (state.phase === "creating") return "Creating your claim...";
    if (state.phase === "uploading") return "Uploading and verifying your files...";
    if (state.phase === "submitting") return "Submitting your claim for review...";
    return "";
}

function failureMessage(state: SubmissionState): string {
    if (state.failedStep === "create") return state.error?.detail ?? "We could not create your claim. Please try again.";
    if (state.failedStep === "upload") return "Some files could not be uploaded or verified. Your claim is saved as a draft. Retry the failed files to continue.";
    return state.error?.detail ? `Your files are uploaded, but the claim could not be submitted: ${state.error.detail}` : "Your files are uploaded, but the claim could not be submitted. Please try again.";
}

function submitLabel(state: SubmissionState): string {
    if (isSubmissionBusy(state)) return "Submitting...";
    if (state.failedStep === "upload") return "Retry failed uploads";
    if (state.failedStep === "submit") return "Try submitting again";
    return "Submit claim";
}

function NewClaimForm({ onStartAnother }: { onStartAnother: () => void }) {
    const [values, setValues] = useState<ClaimFormValues>(EMPTY_CLAIM_FORM);
    const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
    const [rejected, setRejected] = useState<RejectedFile[]>([]);
    const [errors, setErrors] = useState<ClaimFormErrors>({});
    const [summaryVisible, setSummaryVisible] = useState(false);
    const [checkingFiles, setCheckingFiles] = useState(false);
    const [submittedOrderId, setSubmittedOrderId] = useState("");
    const summaryRef = useRef<HTMLDivElement>(null);
    const { state, submit } = useClaimSubmission();

    const busy = isSubmissionBusy(state);
    const locked = busy || Boolean(state.claimId);
    const progress = submissionProgress(state);
    const orderNotFound = state.failedStep === "create" && state.error?.kind === "not_found" && values.orderId === submittedOrderId;
    const fieldErrors: ClaimFormErrors = orderNotFound ? { ...errors, orderId: "We could not find this order on your account. Check the order ID." } : errors;
    const summaryEntries = Object.entries(fieldErrors) as [ClaimFormField, string][];

    useEffect(() => {
        if (summaryVisible) summaryRef.current?.focus();
    }, [summaryVisible]);

    useEffect(() => {
        if (state.phase === "submitted") document.getElementById("claim-submitted-title")?.focus();
    }, [state.phase]);

    if (state.phase === "submitted" && state.claimId && state.result) return <SubmissionResult claimId={state.claimId} status={state.result.status} onStartAnother={onStartAnother} />;

    function update<K extends keyof ClaimFormValues>(field: K, value: ClaimFormValues[K]) {
        setValues((current) => ({ ...current, [field]: value }));
        if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    }

    async function addFiles(files: File[]) {
        setCheckingFiles(true);
        const accepted: EvidenceFile[] = [];
        const nextRejected: RejectedFile[] = [];
        const knownKeys = new Set(evidence.map((item) => item.key));
        for (const file of files) {
            const key = evidenceKey(file);
            if (knownKeys.has(key)) continue;
            if (evidence.length + accepted.length >= MAX_EVIDENCE_FILES) {
                nextRejected.push({ name: file.name, reason: `You can add up to ${MAX_EVIDENCE_FILES} files.` });
                continue;
            }
            const check = await checkEvidenceFile(file);
            if (check.ok) {
                accepted.push({ key, file, contentType: check.contentType });
                knownKeys.add(key);
            } else {
                nextRejected.push({ name: file.name, reason: check.error });
            }
        }
        setEvidence((current) => [...current, ...accepted]);
        setRejected(nextRejected);
        if (accepted.length) setErrors((current) => ({ ...current, evidence: undefined }));
        setCheckingFiles(false);
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || checkingFiles) return;
        if (!state.claimId) {
            const nextErrors = validateClaimForm(values, evidence.length);
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) {
                setSummaryVisible(false);
                requestAnimationFrame(() => setSummaryVisible(true));
                return;
            }
        }
        setSummaryVisible(false);
        setSubmittedOrderId(values.orderId);
        void submit(values, evidence);
    }

    const sessionError = state.phase === "failed" && state.error && SESSION_ERROR_KINDS.has(state.error.kind) ? state.error : undefined;

    return <form className={styles.layout} onSubmit={handleSubmit} noValidate aria-busy={busy}>
        <div className={styles.main}>
            {summaryVisible && summaryEntries.length > 0 && <div ref={summaryRef} tabIndex={-1} className={styles.summary} role="alert" aria-labelledby="claim-error-summary-title">
                <h2 id="claim-error-summary-title">Check the highlighted details</h2>
                <ul>{summaryEntries.map(([field, message]) => <li key={field}><a href={`#${FIELD_IDS[field]}`}>{message}</a></li>)}</ul>
            </div>}

            <Card className={styles.section} aria-labelledby="claim-details-title">
                <h2 id="claim-details-title">Claim details</h2>
                <p className={styles.sectionIntro}>Tell us which order this is about and what went wrong.</p>
                <div className={styles.fieldGrid}>
                    <Field id={FIELD_IDS.orderId} label="Order ID" value={values.orderId} onChange={(event) => update("orderId", event.target.value)} error={fieldErrors.orderId} help="You can find it in your order confirmation email." autoComplete="off" spellCheck={false} disabled={locked} required />
                    <SelectField id={FIELD_IDS.claimType} label="What went wrong?" value={values.claimType} onChange={(event) => update("claimType", event.target.value as ClaimFormValues["claimType"])} options={CLAIM_TYPE_OPTIONS} placeholder="Choose a reason" error={fieldErrors.claimType} disabled={locked} required />
                    <Field id={FIELD_IDS.requestedAmount} label={`Refund amount (${CLAIM_CURRENCY})`} value={values.requestedAmount} onChange={(event) => update("requestedAmount", event.target.value)} error={fieldErrors.requestedAmount} help="It cannot be more than you paid for the order." inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={locked} required />
                </div>
                <TextareaField id={FIELD_IDS.reason} label="Describe what happened" value={values.reason} onChange={(event) => update("reason", event.target.value)} error={fieldErrors.reason} help={`${values.reason.trim().length} of ${REASON_MAX_LENGTH} characters. Include dates and anything you have already tried.`} rows={6} maxLength={REASON_MAX_LENGTH} disabled={locked} required />
            </Card>

            <Card className={styles.section} aria-labelledby="claim-evidence-title">
                <h2 id="claim-evidence-title">Evidence</h2>
                <p className={styles.sectionIntro}>Add photos, receipts, or tracking details that support your claim.</p>
                <FilePicker id={FIELD_IDS.evidence} label="Drop files here or choose them" description={`PDF, JPEG, PNG, or WebP. Up to 4 MB each, ${MAX_EVIDENCE_FILES} files at most.`} accept={EVIDENCE_ACCEPT} multiple disabled={locked || checkingFiles || evidence.length >= MAX_EVIDENCE_FILES} error={fieldErrors.evidence} onFiles={(files) => void addFiles(files)} />
                {checkingFiles && <p className={styles.hint} role="status">Checking files...</p>}
                {rejected.length > 0 && <Notice variant="warning" className={styles.rejected}>
                    <div><strong>Some files were not added</strong><ul>{rejected.map((file) => <li key={file.name}>{file.name}: {file.reason}</li>)}</ul></div>
                </Notice>}
                <EvidenceList evidence={evidence} uploads={state.uploads} onRemove={locked ? undefined : (key) => setEvidence((current) => current.filter((item) => item.key !== key))} />
            </Card>

            {(busy || state.phase === "failed") && <Card className={styles.section} aria-labelledby="claim-progress-title">
                <h2 id="claim-progress-title">Submission</h2>
                {busy && <div className={styles.progress} role="status">
                    <ProgressBar label={statusMessage(state)} value={progress.completed} max={progress.total} valueText={`${progress.completed} of ${progress.total} steps`} />
                </div>}
                {sessionError ? <ApiErrorState error={sessionError} /> : state.phase === "failed" && !orderNotFound && <Notice variant="destructive">{failureMessage(state)}</Notice>}
            </Card>}

            <div className={styles.actions}>
                <Button asChild variant="outline" size="pill"><Link href="/dashboard/">Cancel</Link></Button>
                <Button type="submit" size="pill" disabled={busy || checkingFiles || Boolean(sessionError)}>{submitLabel(state)}</Button>
            </div>
        </div>

        <aside className={styles.aside} aria-labelledby="claim-next-title">
            <Card className={styles.section}>
                <h2 id="claim-next-title">What happens next</h2>
                <ol className={styles.steps}>{NEXT_STEPS.map(([title, description]) => <li key={title}><strong>{title}</strong><span>{description}</span></li>)}</ol>
            </Card>
        </aside>
    </form>;
}

export function NewClaim() {
    const [attempt, setAttempt] = useState(0);
    return <>
        <header className="dl-page-head"><div><h1>New refund claim</h1><p>Request a refund for an order and add evidence to support it.</p></div></header>
        <NewClaimForm key={attempt} onStartAnother={() => setAttempt((value) => value + 1)} />
    </>;
}
