"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { PDFDocument } from "pdf-lib";

import { AppShell } from "@/components/app-shell";
import { EvidenceUploader, PageHeader } from "@/components/claim-components";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { loadEvidence, removeEvidence, saveEvidence } from "@/lib/evidence-storage";
import { clearDraft, saveDraft, useActionMutation } from "@/lib/store";
import { parseDraft, validateDraft, isSubmitted } from "@/features/customer/draft";
import { EMPTY_DRAFT, type Claim, type ClaimDraft, type EvidenceMetadata, money } from "@/lib/types";

const CLAIM_TYPES = [
  { value: "damaged_item", label: "Damaged item", hint: "Include your receipt and clear photos of the damage." },
  { value: "wrong_item", label: "Wrong item", hint: "Include your order confirmation and a photo of the item or label." },
  { value: "non_delivery", label: "Non-delivery", hint: "Include your order confirmation and tracking information." },
  { value: "delayed_delivery", label: "Delayed delivery", hint: "Delay-only claims apply to eligible shipping fees." },
];

function storageKey(accountKey: string) { return `refundflow.customer-draft.v2:${accountKey}`; }
function returnKey(accountKey: string) { return `refundflow.customer-return.v1:${accountKey}`; }
function selectedType(claimType: string) { return CLAIM_TYPES.find((type) => type.value === claimType) ?? CLAIM_TYPES[0]; }
function evidenceId(file: File) { return `${file.name}-${file.size}-${file.lastModified}`; }
function readDraft(accountKey: string): ClaimDraft { return parseDraft(localStorage.getItem(storageKey(accountKey))); }

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function Stepper({ step, disabled }: { step: 1 | 2 | 3; disabled?: boolean }) {
  const steps = ["Order and issue", "Evidence", "Review and submit"];
  const paths = ["/claims/new/issue", "/claims/new/evidence", "/claims/new/check"];
  return <nav className="stepper" aria-label="Claim submission steps">{steps.map((name, index) => <Link key={name} href={paths[index]} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }} aria-current={step === index + 1 ? "step" : undefined} className={step === index + 1 ? "current" : ""}>{index + 1}. {name}</Link>)}</nav>;
}

export function CustomerClaimFlow({ step }: { step: 1 | 2 | 3 }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const session = useSession();
  const [action] = useActionMutation();
  const [draft, setDraft] = useState<ClaimDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const previewUrls = useRef<Record<string,string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const queryArg = useMemo(() => ({ mode: session.mode, role: session.role, accountKey: session.accountKey }), [session.mode, session.role, session.accountKey]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      let restored: ClaimDraft;
      try { restored = readDraft(session.accountKey); }
      catch (error) { if (active) { setRecoveryError(errorMessage(error)); setReady(true); } return; }
      if (!active) return;
      setDraft(restored);
      dispatch(saveDraft({ accountKey: session.accountKey, draft: restored }));
      await Promise.all(restored.files.map(async metadata => {
        if (restored.uploaded?.includes(metadata.id)) return;
        try {
          const file = await loadEvidence(session.accountKey, metadata.id);
          if (!file) throw new Error("The saved file is no longer available.");
          if (active && file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            previewUrls.current[metadata.id] = url;
            setPreviews(current => ({ ...current, [metadata.id]: url }));
          }
        } catch (error) {
          if (!active) return;
          setRecoveryError(`${metadata.name} needs to be selected again. ${errorMessage(error)}`);
          setDraft(current => ({ ...current, files: current.files.map(file => file.id === metadata.id ? { ...file, status: "Needs reselection" } : file) }));
        }
      }));
      if (active) setReady(true);
    });
    return () => { active = false; Object.values(previewUrls.current).forEach(url => URL.revokeObjectURL(url)); previewUrls.current = {}; };
  }, [dispatch, session.accountKey]);

  function persist(next: ClaimDraft) {
    setDraft(next);
    dispatch(saveDraft({ accountKey: session.accountKey, draft: next }));
    try { localStorage.setItem(storageKey(session.accountKey), JSON.stringify(next)); } catch { setRecoveryError("Your browser could not save the draft. Keep this tab open while you finish the claim."); }
  }

  async function chooseFiles(files: File[]) {
    const additions: EvidenceMetadata[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const id = evidenceId(file);
      const missing = draft.files.find((existing) => existing.id === id && existing.status === "Needs reselection");
      if (draft.claimId && !missing) { errors.push("This claim is already created. You can only reselect an exact missing file. Start a new draft to change evidence."); break; }
      if (!draft.files.some(existing => existing.id === id) && draft.files.length + additions.filter(added => !draft.files.some(existing => existing.id === added.id)).length >= 5) { errors.push("You can attach up to five files. Remove a file before adding another."); break; }
      if (!file.type || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) { errors.push(`${file.name} has an unsupported type. Use PDF, JPEG, PNG, or WebP.`); continue; }
      if (file.size === 0) { errors.push(`${file.name} is empty.`); continue; }
      if (file.size > 4 * 1024 * 1024) { errors.push(`${file.name} is larger than 4 MB.`); continue; }
      if (file.type === "application/pdf") try { if ((await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false })).getPageCount() > 2) { errors.push(`${file.name} has more than two pages.`); continue; } } catch { errors.push(`${file.name} is not a readable PDF. Choose an unencrypted PDF with up to two pages.`); continue; }
      try {
        await saveEvidence(session.accountKey, id, file);
        additions.push({ id, name: file.name, size: file.size, type: file.type, status: "Ready to upload" });
        if (file.type.startsWith("image/")) { if (previewUrls.current[id]) URL.revokeObjectURL(previewUrls.current[id]); const url = URL.createObjectURL(file); previewUrls.current[id] = url; setPreviews(current => ({ ...current, [id]: url })); }
      } catch (error) { errors.push(error instanceof Error ? error.message : `Could not save ${file.name}.`); }
    }
    if (additions.length) setRecoveryError("");
    if (additions.length) persist({ ...draft, files: [...draft.files.filter((file) => !additions.some((added) => added.id === file.id)), ...additions] });
    setMessage(errors.join(" "));
  }

  async function removeFile(id: string) {
    if (draft.claimId) { setMessage("This claim is already created. Evidence cannot be removed after a secure upload slot is allocated. Start a new draft if you need to change it."); return; }
    try { await removeEvidence(session.accountKey, id); } catch (error) { setMessage(error instanceof Error ? error.message : "Evidence could not be removed."); return; }
    if (previewUrls.current[id]) URL.revokeObjectURL(previewUrls.current[id]);
    delete previewUrls.current[id];
    setPreviews((current) => { const next = { ...current }; delete next[id]; return next; });
    persist({ ...draft, files: draft.files.filter((file) => file.id !== id), uploaded: draft.uploaded?.filter((fileId) => fileId !== id) });
  }

  function saveIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.claimId) { sessionStorage.removeItem(returnKey(session.accountKey)); router.push("/claims/new/check"); return; }
    const next = { ...draft, orderId: draft.orderId.trim(), amount: draft.amount.trim(), reason: draft.reason.trim() };
    if (!next.orderId || !/^[-A-Za-z0-9_]+$/.test(next.orderId)) { setMessage("Enter the order reference using letters, numbers, hyphens, or underscores."); return; }
    if (!Number.isFinite(Number(next.amount)) || Number(next.amount) <= 0) { setMessage("Enter a requested amount greater than zero."); return; }
    if (next.reason.length < 10 || next.reason.length > 2000) { setMessage("Explain what happened in 10 to 2,000 characters."); return; }
    if (draft.claimId) { setMessage("This claim is already created, so its order details cannot be changed. Start a new draft if you need to make changes."); return; }
    const validationError = validateDraft(next); if (validationError) { setMessage(validationError); return; }
    persist(next); setMessage("");
    const returnToReview = sessionStorage.getItem(returnKey(session.accountKey)) === "review";
    sessionStorage.removeItem(returnKey(session.accountKey));
    router.push(returnToReview ? "/claims/new/check" : "/claims/new/evidence");
  }

  function startNewDraft() {
    try { localStorage.removeItem(storageKey(session.accountKey)); } catch { /* The in-memory reset still allows a new claim. */ }
    sessionStorage.removeItem(returnKey(session.accountKey));
    void Promise.all(draft.files.map(file => removeEvidence(session.accountKey, file.id))).catch(() => setRecoveryError("Some old evidence could not be cleared from this browser."));
    Object.values(previewUrls.current).forEach(url => URL.revokeObjectURL(url)); previewUrls.current = {};
    dispatch(clearDraft(session.accountKey));
    setDraft(EMPTY_DRAFT); setProgress({}); setPreviews({}); setMessage(""); setRecoveryError("");
    router.push("/claims/new/issue");
  }

  async function uploadFile(metadata: EvidenceMetadata, claimId: string, currentDraft: ClaimDraft): Promise<ClaimDraft> {
    const file = await loadEvidence(session.accountKey, metadata.id);
    if (!file) throw new Error(`${metadata.name} is missing. Select it again before submitting.`);
    setProgress((current) => ({ ...current, [metadata.id]: "Requesting secure upload..." }));
    const grant = currentDraft.grants?.[metadata.id] ?? await action({ ...queryArg, path: `/v1/claims/${claimId}/uploads`, init: { method: "POST", body: JSON.stringify({ file_name: file.name, content_type: file.type, size_bytes: file.size }) } }).unwrap() as { document_id: string; upload_url: string; required_headers: Record<string, string> };
    const withGrant = { ...currentDraft, grants: { ...currentDraft.grants, [metadata.id]: grant } };
    persist(withGrant);
    setProgress((current) => ({ ...current, [metadata.id]: "Uploading..." }));
    if (session.mode === "live") {
      const response = await fetch(grant.upload_url, { method: "PUT", headers: grant.required_headers, body: file });
      if (!response.ok) throw new Error(`${metadata.name} could not be transferred. Retry this file when your connection is ready.`);
    }
    setProgress((current) => ({ ...current, [metadata.id]: "Verifying..." }));
    await action({ ...queryArg, path: `/v1/claims/${claimId}/uploads/${grant.document_id}/complete`, init: { method: "POST" } }).unwrap();
    const uploaded = [...(withGrant.uploaded ?? []), metadata.id];
    const completedDraft = { ...withGrant, uploaded, files: withGrant.files.map((file) => file.id === metadata.id ? { ...file, status: "Uploaded" } : file) };
    persist(completedDraft);
    setProgress((current) => ({ ...current, [metadata.id]: "Uploaded" }));
    return completedDraft;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || session.role !== "Customer") return;
    const validationError = validateDraft(draft); if (validationError) { setMessage(validationError); return; }
    if (!draft.files.length) { setMessage("Add at least one evidence file before submitting."); return; }
    if (draft.files.some((file) => file.status === "Needs reselection")) { setMessage("Reselect the evidence file marked as missing before submitting."); return; }
    setBusy(true); setMessage("");
    try {
      let current = draft;
      let claimId = current.claimId;
      if (claimId) {
        const existing = await action({ ...queryArg, path: `/v1/claims/${claimId}`, init: {} }).unwrap() as Claim;
        if (isSubmitted(existing.status)) { await finishSubmission(current, claimId); return; }
      }
      if (!claimId) {
        setMessage("Creating your claim...");
        if (!current.orderId || !/^[-A-Za-z0-9_]+$/.test(current.orderId) || !Number.isFinite(Number(current.amount)) || Number(current.amount) <= 0 || current.reason.trim().length < 10 || current.reason.trim().length > 2000) throw new Error("Complete the order, amount, and explanation before submitting.");
        const created = await action({ ...queryArg, path: "/v1/claims", init: { method: "POST", body: JSON.stringify({ order_id: current.orderId, claim_type: current.claimType, reason: current.reason, requested_amount: current.amount, currency: "CAD" }) } }).unwrap() as Claim;
        claimId = created.id; current = { ...current, claimId }; persist(current);
      }
      for (const file of current.files) if (!current.uploaded?.includes(file.id)) current = await uploadFile(file, claimId, current);
      setMessage("Submitting your claim for review...");
      await action({ ...queryArg, path: `/v1/claims/${claimId}/submit`, init: { method: "POST" } }).unwrap();
      await finishSubmission(current, claimId);
    } catch (error) { setMessage(`${errorMessage(error)} Your draft remains saved, and you can retry.`); }
    finally { setBusy(false); }
  }

  async function finishSubmission(current: ClaimDraft, claimId: string) {
    let cleanupWarning = false;
    try { localStorage.removeItem(storageKey(session.accountKey)); sessionStorage.removeItem(returnKey(session.accountKey)); }
    catch { cleanupWarning = true; }
    const results = await Promise.allSettled(current.files.map(file => removeEvidence(session.accountKey, file.id)));
    cleanupWarning ||= results.some(result => result.status === "rejected");
    dispatch(clearDraft(session.accountKey));
    router.push(`/claims/received?claimId=${encodeURIComponent(claimId)}${cleanupWarning ? "&cleanup=failed" : ""}`);
  }

  if (session.authenticated && session.role !== "Customer") return <AppShell><section className="surface" role="alert"><h1 className="page-title">Customer access required</h1><p>Sign in with a customer account to start a claim.</p></section></AppShell>;
  if (!ready) return <AppShell><section className="surface" role="status">Restoring your draft...</section></AppShell>;
  const issue = selectedType(draft.claimType);
  return <AppShell><PageHeader title={step === 1 ? "Start a refund claim" : step === 2 ? "Add your evidence" : "Review and submit"} description="Your draft is saved to this signed-in workspace."/><Stepper step={step} disabled={busy}/>{(message || recoveryError) && <section className="error-summary" role="alert"><strong>{message.includes("Creating") || message.includes("Submitting") ? "Working on your claim" : "Check your claim"}</strong><p>{message || recoveryError}</p></section>}
    {step === 1 && <form className="surface" onSubmit={saveIssue}><h2 className="section-title">Tell us about the order</h2>{draft.claimId && <div className="notice">This claim already has a server reference. Its submitted details are locked to prevent mismatched evidence. <Button type="button" variant="secondary" onClick={startNewDraft}>Start a new draft</Button></div>}<div className="form-grid"><label className="field">Order reference<input required disabled={Boolean(draft.claimId)} value={draft.orderId} onChange={(event) => persist({ ...draft, orderId: event.target.value })} placeholder="e.g. order-1001"/></label><label className="field">Requested refund amount<input required disabled={Boolean(draft.claimId)} type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => persist({ ...draft, amount: event.target.value })} placeholder="0.00"/></label><fieldset className="field full"><legend>What happened?</legend><div className="issue-options">{CLAIM_TYPES.map((type) => <button type="button" disabled={Boolean(draft.claimId)} key={type.value} className="issue-option" aria-pressed={draft.claimType === type.value} onClick={() => persist({ ...draft, claimType: type.value })}>{type.label}</button>)}</div><span className="helper">{issue.hint}</span></fieldset><label className="field full">What should we know? <span className="helper">{draft.reason.length}/2,000 characters</span><textarea required disabled={Boolean(draft.claimId)} minLength={10} maxLength={2000} value={draft.reason} onChange={(event) => persist({ ...draft, reason: event.target.value })} placeholder="Describe what happened with your order."/></label></div><p className="helper">Eligibility and the final amount are checked against the order and policy.</p><div className="button-row"><Button>{draft.claimId ? "Back to review" : "Continue to evidence"}</Button></div></form>}
    {step === 2 && <section className="surface"><h2 className="section-title">Supporting evidence</h2><p className="helper">{issue.hint}</p><EvidenceUploader files={draft.files} onSelect={chooseFiles} onRemove={removeFile} disabled={busy || Boolean(draft.claimId && !draft.files.some(file => file.status === "Needs reselection"))} disableRemove={Boolean(draft.claimId)}/>{draft.files.filter((file) => previews[file.id]).map((file) => <figure key={file.id} className="surface"><Image unoptimized width={720} height={480} style={{width:"auto",height:"auto"}} className="preview-image" src={previews[file.id]} alt={`Preview of ${file.name}`}/><figcaption className="helper">Preview: {file.name}</figcaption></figure>)}<div className="button-row"><Button variant="secondary" asChild><Link href="/claims/new/issue">Back</Link></Button>{draft.files.length ? <Button asChild><Link href="/claims/new/check">Review claim</Link></Button> : <Button disabled>Review claim</Button>}</div></section>}
    {step === 3 && <section className="surface"><h2 className="section-title">Check your claim</h2><dl className="detail-grid"><div><dt>Order reference</dt><dd>{draft.orderId || "Not provided"} <Link className="text-link" href="/claims/new/issue" onClick={() => sessionStorage.setItem(returnKey(session.accountKey), "review")}>Edit</Link></dd></div><div><dt>Requested refund</dt><dd>{draft.amount ? money(draft.amount) : "Not provided"} <Link className="text-link" href="/claims/new/issue" onClick={() => sessionStorage.setItem(returnKey(session.accountKey), "review")}>Edit</Link></dd></div><div><dt>Issue</dt><dd>{issue.label} <Link className="text-link" href="/claims/new/issue" onClick={() => sessionStorage.setItem(returnKey(session.accountKey), "review")}>Edit</Link></dd></div><div><dt>Evidence</dt><dd>{draft.files.length} file{draft.files.length === 1 ? "" : "s"} <Link className="text-link" href="/claims/new/evidence">Edit</Link></dd></div><div className="full"><dt>Your explanation</dt><dd>{draft.reason || "Not provided"} <Link className="text-link" href="/claims/new/issue" onClick={() => sessionStorage.setItem(returnKey(session.accountKey), "review")}>Edit</Link></dd></div></dl><ul className="file-list">{draft.files.map((file) => <li className="file-row" key={file.id}><span>{file.name}</span><span className="helper">{progress[file.id] ?? file.status}</span></li>)}</ul><p className="notice">A person reviews every refund decision. Your requested amount is not a payment confirmation.</p><form onSubmit={submit}><div className="button-row"><Button variant="secondary" asChild><Link href="/claims/new/evidence" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>Back</Link></Button><Button disabled={busy || !draft.files.length}>{busy ? "Submitting..." : draft.claimId ? "Retry submission" : "Submit claim"}</Button></div></form></section>}
  </AppShell>;
}
