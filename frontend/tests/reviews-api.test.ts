import { describe, expect, it, vi } from "vitest";
import { reviewsApi } from "@/features/reviews/api";
import { downloadEvidence } from "@/features/reviews/evidence-download";
import { ApiAuthRequiredError } from "@/lib/api/base-query";
import { createApiHarness, jsonResponse, TEST_BASE_URL, TEST_TOKEN } from "./support/api-harness";
import { REVIEW_DETAIL } from "./support/review-fixtures";

describe("listReviewClaims", () => {
    it("filters claims by status for the review queue", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, [REVIEW_DETAIL.claim]));
        const result = await store.dispatch(reviewsApi.endpoints.listReviewClaims.initiate({ status: "pending_approval" }));

        expect(result.data).toEqual([REVIEW_DETAIL.claim]);
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/claims?status=pending_approval`);
        expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${TEST_TOKEN}`);
    });
});

describe("getReview", () => {
    it("loads the review detail for an encoded claim id", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, REVIEW_DETAIL));
        const result = await store.dispatch(reviewsApi.endpoints.getReview.initiate("claim test/001"));

        expect(result.data).toEqual(REVIEW_DETAIL);
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/reviews/claim%20test%2F001`);
    });

    it("reports an assessment that is not ready as a conflict", async () => {
        const { store } = createApiHarness(() => jsonResponse(409, { detail: "Assessment is not ready" }));
        const result = await store.dispatch(reviewsApi.endpoints.getReview.initiate("claim-test-001"));

        expect(result.error).toEqual({ kind: "conflict", status: 409, detail: "Assessment is not ready" });
    });
});

describe("decideReview", () => {
    it("posts the decision and refreshes the review", async () => {
        let reviewLoads = 0;
        const { store, requests } = createApiHarness((request) => {
            if (request.method === "POST") return jsonResponse(202, { status: "accepted" });
            reviewLoads += 1;
            return jsonResponse(200, REVIEW_DETAIL);
        });
        const subscription = store.dispatch(reviewsApi.endpoints.getReview.initiate("claim-test-001"));
        await subscription;

        const result = await store.dispatch(reviewsApi.endpoints.decideReview.initiate({ claimId: "claim-test-001", decision: "approve", comment: "Evidence matches the order." }));
        await vi.waitFor(() => expect(reviewLoads).toBe(2));
        subscription.unsubscribe();

        expect(result.data).toEqual({ status: "accepted" });
        const post = requests.find((request) => request.method === "POST");
        expect(post?.url).toBe(`${TEST_BASE_URL}/v1/reviews/claim-test-001/decision`);
        expect(JSON.parse(post?.body ?? "")).toEqual({ decision: "approve", comment: "Evidence matches the order." });
    });

    it("surfaces a conflicting decision from the backend", async () => {
        const { store } = createApiHarness(() => jsonResponse(409, { detail: "Reviewer already submitted a different decision" }));
        const result = await store.dispatch(reviewsApi.endpoints.decideReview.initiate({ claimId: "claim-test-001", decision: "reject", comment: "Changed my mind." }));

        expect(result.error).toEqual({ kind: "conflict", status: 409, detail: "Reviewer already submitted a different decision" });
    });
});

describe("downloadEvidence", () => {
    const path = REVIEW_DETAIL.documents[0].download_path;

    function services(fetchFn: typeof fetch, getAccessToken = async () => TEST_TOKEN) {
        return { baseUrl: TEST_BASE_URL, getAccessToken, fetchFn };
    }

    it("downloads evidence with the reviewer's bearer token", async () => {
        const fetchFn = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } }));
        const blob = await downloadEvidence(services(fetchFn as typeof fetch), path);

        expect(blob.size).toBe(3);
        expect(fetchFn).toHaveBeenCalledWith(`${TEST_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${TEST_TOKEN}` } });
    });

    it.each(["https://elsewhere.example.test/v1/reviews/a/documents/b", "//elsewhere.example.test/x", "/v1/claims/claim-test-001", "/v1/reviews/a/documents/b/../../c"])("refuses to send the token to %s", async (unsafePath) => {
        const fetchFn = vi.fn();
        await expect(downloadEvidence(services(fetchFn as unknown as typeof fetch), unsafePath)).rejects.toMatchObject({ kind: "validation" });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it.each([[401, "unauthorized"], [403, "forbidden"], [404, "not_found"], [500, "server"]] as const)("maps HTTP %i to %s", async (status, kind) => {
        const fetchFn = vi.fn(async () => new Response(null, { status }));
        await expect(downloadEvidence(services(fetchFn as typeof fetch), path)).rejects.toMatchObject({ kind, status });
    });

    it("asks the reviewer to sign in again when the token cannot be renewed", async () => {
        const fetchFn = vi.fn();
        await expect(downloadEvidence(services(fetchFn as unknown as typeof fetch, async () => { throw new ApiAuthRequiredError(); }), path)).rejects.toMatchObject({ kind: "unauthorized" });
    });

    it("reports a missing API configuration", async () => {
        await expect(downloadEvidence({ baseUrl: "", getAccessToken: async () => TEST_TOKEN }, path)).rejects.toMatchObject({ kind: "not_configured" });
    });
});
