import { describe, expect, it, vi } from "vitest";
import { claimSubmissionReducer, INITIAL_SUBMISSION, submissionProgress, type SubmissionAction, type SubmissionState } from "@/features/claims/claim-submission";
import { runClaimSubmission, type EvidenceFile } from "@/features/claims/claim-submission-runner";
import { BlobUploadError } from "@/features/claims/blob-upload";
import type { ClaimFormValues } from "@/features/claims/claim-form-validation";
import { createApiHarness, jsonResponse, type RecordedRequest } from "./support/api-harness";

const VALUES: ClaimFormValues = { orderId: " order-test-001 ", claimType: "damaged_item", requestedAmount: "42.50", reason: "The parcel arrived crushed." };

function evidence(key: string): EvidenceFile {
    return { key, file: new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], `${key}.png`, { type: "image/png" }), contentType: "image/png" };
}

function backend(overrides: (request: RecordedRequest, path: string) => Response | undefined = () => undefined) {
    let grants = 0;
    return (request: RecordedRequest) => {
        const path = new URL(request.url).pathname;
        const override = overrides(request, path);
        if (override) return override;
        if (path === "/v1/claims") return jsonResponse(201, { id: "claim-test-001" });
        if (path.endsWith("/uploads")) {
            grants += 1;
            return jsonResponse(200, { document_id: `document-${grants}`, blob_name: "b", upload_url: `https://storage.example.test/${grants}`, required_headers: {} });
        }
        if (path.endsWith("/complete")) return jsonResponse(202, { status: "verified", document_id: "d" });
        if (path.endsWith("/submit")) return jsonResponse(202, { status: "scanning", workflow_instance_id: "workflow-test-001" });
        return jsonResponse(500, {});
    };
}

function runner(responder: (request: RecordedRequest) => Response, uploadToBlob = vi.fn(async () => undefined)) {
    const harness = createApiHarness(responder);
    let state: SubmissionState = INITIAL_SUBMISSION;
    const deps = { dispatch: harness.store.dispatch, getState: () => state, apply: (action: SubmissionAction) => { state = claimSubmissionReducer(state, action); }, uploadToBlob };
    return { ...harness, deps, uploadToBlob, state: () => state, paths: () => harness.requests.map((request) => new URL(request.url).pathname) };
}

describe("runClaimSubmission", () => {
    it("creates, uploads, verifies, and submits in order", async () => {
        const run = runner(backend());
        await runClaimSubmission(run.deps, VALUES, [evidence("a"), evidence("b")]);

        expect(run.paths()).toEqual([
            "/v1/claims",
            "/v1/claims/claim-test-001/uploads",
            "/v1/claims/claim-test-001/uploads/document-1/complete",
            "/v1/claims/claim-test-001/uploads",
            "/v1/claims/claim-test-001/uploads/document-2/complete",
            "/v1/claims/claim-test-001/submit",
        ]);
        expect(JSON.parse(run.requests[0].body)).toMatchObject({ order_id: "order-test-001", currency: "CAD" });
        expect(run.uploadToBlob).toHaveBeenCalledTimes(2);
        expect(run.state()).toMatchObject({ phase: "submitted", claimId: "claim-test-001" });
        expect(submissionProgress(run.state())).toEqual({ completed: 4, total: 4 });
    });

    it("retries only the failed file and never creates a second claim", async () => {
        const uploadToBlob = vi.fn(async () => undefined).mockRejectedValueOnce(new BlobUploadError("The file could not be uploaded."));
        const run = runner(backend(), uploadToBlob);
        await runClaimSubmission(run.deps, VALUES, [evidence("a"), evidence("b")]);

        expect(run.state()).toMatchObject({ phase: "failed", failedStep: "upload" });
        expect(run.state().uploads.a).toMatchObject({ stage: "failed", error: "The file could not be uploaded.", uploaded: false });
        expect(run.state().uploads.b.stage).toBe("verified");

        await runClaimSubmission(run.deps, VALUES, [evidence("a"), evidence("b")]);

        expect(run.paths().filter((path) => path === "/v1/claims")).toHaveLength(1);
        expect(run.paths().filter((path) => path.endsWith("/uploads"))).toHaveLength(2);
        expect(uploadToBlob).toHaveBeenCalledTimes(3);
        expect(run.state().phase).toBe("submitted");
    });

    it("repeats only verification when the Blob already has the file", async () => {
        let completeCalls = 0;
        const run = runner(backend((_request, path) => path.endsWith("/complete") && ++completeCalls === 1 ? jsonResponse(503, { detail: "Synthetic outage." }) : undefined));
        await runClaimSubmission(run.deps, VALUES, [evidence("a")]);
        expect(run.state().uploads.a).toMatchObject({ stage: "failed", uploaded: true, error: "Synthetic outage." });

        await runClaimSubmission(run.deps, VALUES, [evidence("a")]);

        expect(run.uploadToBlob).toHaveBeenCalledTimes(1);
        expect(run.state().phase).toBe("submitted");
    });

    it("stops on a session error so the customer can sign in again", async () => {
        const run = runner(backend((_request, path) => path.endsWith("/uploads") ? jsonResponse(401, { detail: "Expired." }) : undefined));
        await runClaimSubmission(run.deps, VALUES, [evidence("a"), evidence("b")]);

        expect(run.state()).toMatchObject({ phase: "failed", failedStep: "upload", error: { kind: "unauthorized" } });
        expect(run.state().uploads.b.stage).toBe("waiting");
        expect(run.paths().filter((path) => path.endsWith("/uploads"))).toHaveLength(1);
    });

    it("reports a failed claim creation without uploading", async () => {
        const run = runner(backend((_request, path) => path === "/v1/claims" ? jsonResponse(404, { detail: "Order not found" }) : undefined));
        await runClaimSubmission(run.deps, VALUES, [evidence("a")]);

        expect(run.state()).toMatchObject({ phase: "failed", failedStep: "create", error: { kind: "not_found" } });
        expect(run.state().claimId).toBeUndefined();
        expect(run.uploadToBlob).not.toHaveBeenCalled();
    });

    it("retries submission without uploading again", async () => {
        let submitCalls = 0;
        const run = runner(backend((_request, path) => path.endsWith("/submit") && ++submitCalls === 1 ? jsonResponse(500, {}) : undefined));
        await runClaimSubmission(run.deps, VALUES, [evidence("a")]);
        expect(run.state()).toMatchObject({ phase: "failed", failedStep: "submit" });

        await runClaimSubmission(run.deps, VALUES, [evidence("a")]);

        expect(run.uploadToBlob).toHaveBeenCalledTimes(1);
        expect(run.state().phase).toBe("submitted");
    });
});
