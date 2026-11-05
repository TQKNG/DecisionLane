"use client";

import { FormEvent, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useApi } from "@/lib/api";

interface Claim {
  id: string;
}

interface UploadGrant {
  document_id: string;
  upload_url: string;
  required_headers: Record<string, string>;
}

export default function NewClaimPage() {
  const { request } = useApi();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Creating claim...");
    try {
      const formData = new FormData(event.currentTarget);
      const files = formData.getAll("documents") as File[];
      if (files.length < 1 || files.length > 5) throw new Error("Select one to five files");
      const claim = await request<Claim>("/v1/claims", {
        method: "POST",
        body: JSON.stringify({
          order_id: formData.get("orderId"),
          claim_type: formData.get("claimType"),
          reason: formData.get("reason"),
          requested_amount: formData.get("amount"),
          currency: "CAD",
        }),
      });

      for (const file of files) {
        setMessage(`Uploading ${file.name}...`);
        const grant = await request<UploadGrant>(`/v1/claims/${claim.id}/uploads`, {
          method: "POST",
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type,
            size_bytes: file.size,
          }),
        });
        const upload = await fetch(grant.upload_url, {
          method: "PUT",
          headers: grant.required_headers,
          body: file,
        });
        if (!upload.ok) throw new Error(`Blob upload failed for ${file.name}`);
        await request(`/v1/claims/${claim.id}/uploads/${grant.document_id}/complete`, {
          method: "POST",
        });
      }
      await request(`/v1/claims/${claim.id}/submit`, { method: "POST" });
      setMessage(`Claim ${claim.id} is processing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">New refund claim</h1>
      <form onSubmit={submitClaim} className="mt-8 grid max-w-2xl gap-5">
        <label>Order ID<input required name="orderId" className="mt-2 w-full rounded-lg bg-slate-800 p-3" /></label>
        <label>
          Claim type
          <select name="claimType" className="mt-2 w-full rounded-lg bg-slate-800 p-3">
            <option value="damaged_item">Damaged item</option>
            <option value="wrong_item">Wrong item</option>
            <option value="non_delivery">Non-delivery</option>
            <option value="delayed_delivery">Delayed delivery</option>
          </select>
        </label>
        <label>Reason<textarea required minLength={10} name="reason" className="mt-2 min-h-32 w-full rounded-lg bg-slate-800 p-3" /></label>
        <label>Requested amount in CAD<input required min="0.01" step="0.01" type="number" name="amount" className="mt-2 w-full rounded-lg bg-slate-800 p-3" /></label>
        <label>
          Evidence, one to five PDF or image files, maximum 4 MB each
          <input required multiple name="documents" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-2 block w-full" />
        </label>
        <button disabled={busy} className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">
          {busy ? "Submitting..." : "Submit claim"}
        </button>
        <p role="status" className="text-slate-300">{message}</p>
      </form>
    </AppShell>
  );
}