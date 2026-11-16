import { describe, expect, it } from "vitest";
import { claimsApi } from "@/features/claims/api";
import { createApiHarness, jsonResponse, TEST_BASE_URL, TEST_TOKEN } from "./support/api-harness";

const GRANT = { document_id: "document-test-001", blob_name: "customer-test-001/claim-test-001/document-test-001.png", upload_url: "https://storage.example.test/quarantine/document-test-001.png", required_headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "image/png" } };

describe("claim mutations", () => {
    it("creates a claim with the contract body", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(201, { id: "claim-test-001" }));
        const body = { order_id: "order-test-001", claim_type: "damaged_item" as const, reason: "The parcel arrived crushed.", requested_amount: "42.50", currency: "CAD" };
        await store.dispatch(claimsApi.endpoints.createClaim.initiate(body)).unwrap();

        expect(requests[0].method).toBe("POST");
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/claims`);
        expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${TEST_TOKEN}`);
        expect(JSON.parse(requests[0].body)).toEqual(body);
    });

    it("requests an upload grant for the claim", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, GRANT));
        const upload = { file_name: "photo.png", content_type: "image/png", size_bytes: 1024 };
        const grant = await store.dispatch(claimsApi.endpoints.requestUpload.initiate({ claimId: "claim-test-001", upload })).unwrap();

        expect(grant).toEqual(GRANT);
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/claims/claim-test-001/uploads`);
        expect(JSON.parse(requests[0].body)).toEqual(upload);
    });

    it("completes an upload and submits the claim", async () => {
        const { store, requests } = createApiHarness((request) => request.url.endsWith("/complete")
            ? jsonResponse(202, { status: "verified", document_id: "document-test-001" })
            : jsonResponse(202, { status: "scanning", workflow_instance_id: "workflow-test-001" }));
        await store.dispatch(claimsApi.endpoints.completeUpload.initiate({ claimId: "claim-test-001", documentId: "document-test-001" })).unwrap();
        const result = await store.dispatch(claimsApi.endpoints.submitClaim.initiate({ claimId: "claim-test-001" })).unwrap();

        expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
            "POST /v1/claims/claim-test-001/uploads/document-test-001/complete",
            "POST /v1/claims/claim-test-001/submit",
        ]);
        expect(result.status).toBe("scanning");
    });

    it("encodes identifiers in paths", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(202, { status: "scanning", workflow_instance_id: "w" }));
        await store.dispatch(claimsApi.endpoints.submitClaim.initiate({ claimId: "claim/../x" }));

        expect(new URL(requests[0].url).pathname).toBe("/v1/claims/claim%2F..%2Fx/submit");
    });

    it.each([
        [404, "not_found", "Order not found"],
        [400, "validation", "Requested refund exceeds the paid order amount"],
        [409, "conflict", "Claim is already submitted"],
    ] as const)("maps a %i response to %s", async (status, kind, detail) => {
        const { store } = createApiHarness(() => jsonResponse(status, { detail }));
        const result = await store.dispatch(claimsApi.endpoints.createClaim.initiate({ order_id: "o", claim_type: "wrong_item", reason: "Synthetic reason.", requested_amount: "1", currency: "CAD" }));

        expect(result.error).toEqual({ kind, status, detail });
    });

    it("refreshes the claims list after a submission", async () => {
        let listCalls = 0;
        const { store } = createApiHarness((request) => {
            if (request.method === "GET") {
                listCalls += 1;
                return jsonResponse(200, []);
            }
            return jsonResponse(202, { status: "scanning", workflow_instance_id: "workflow-test-001" });
        });
        const subscription = store.dispatch(claimsApi.endpoints.listClaims.initiate());
        await subscription;
        await store.dispatch(claimsApi.endpoints.submitClaim.initiate({ claimId: "claim-test-001" })).unwrap();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listCalls).toBe(2);
        subscription.unsubscribe();
    });
});
