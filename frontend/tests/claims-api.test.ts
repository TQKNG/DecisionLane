import { describe, expect, it } from "vitest";
import { claimsApi } from "@/features/claims/api";
import type { RefundClaim } from "@/features/claims/types";
import { ApiAuthRequiredError } from "@/lib/api/base-query";
import { createApiHarness, jsonResponse, TEST_BASE_URL, TEST_TOKEN } from "./support/api-harness";

const CLAIM: RefundClaim = {
    id: "claim-test-001",
    customer_id: "customer-test-001",
    customer_email: "customer@example.test",
    order_id: "order-test-001",
    claim_type: "damaged_item",
    reason: "The parcel arrived with a crushed corner.",
    requested_amount: "42.50",
    currency: "CAD",
    status: "pending_approval",
    workflow_instance_id: null,
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-03T12:30:00Z",
};

describe("listClaims", () => {
    it("requests the customer's claims with a bearer token", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, [CLAIM]));
        const result = await store.dispatch(claimsApi.endpoints.listClaims.initiate());

        expect(result.data).toEqual([CLAIM]);
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/claims`);
        expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${TEST_TOKEN}`);
    });

    it("sends the optional status filter as a query parameter", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, []));
        await store.dispatch(claimsApi.endpoints.listClaims.initiate({ status: "draft" }));

        expect(new URL(requests[0].url).searchParams.get("status")).toBe("draft");
    });

    it.each([
        [401, "unauthorized"],
        [403, "forbidden"],
        [500, "server"],
    ] as const)("maps HTTP %i to the %s error kind with the backend detail", async (status, kind) => {
        const { store } = createApiHarness(() => jsonResponse(status, { detail: "Synthetic backend detail." }));
        const result = await store.dispatch(claimsApi.endpoints.listClaims.initiate());

        expect(result.error).toEqual({ kind, status, detail: "Synthetic backend detail." });
    });

    it("joins FastAPI validation messages", async () => {
        const { store } = createApiHarness(() => jsonResponse(422, { detail: [{ loc: ["query", "status"], msg: "Invalid status.", type: "value_error" }] }));
        const result = await store.dispatch(claimsApi.endpoints.listClaims.initiate());

        expect(result.error).toEqual({ kind: "validation", status: 422, detail: "Invalid status." });
    });

    it("reports a network error when the API cannot be reached", async () => {
        const { store } = createApiHarness(() => { throw new TypeError("Failed to fetch"); });
        const result = await store.dispatch(claimsApi.endpoints.listClaims.initiate());

        expect(result.error).toMatchObject({ kind: "network" });
    });

    it("reports unauthorized without calling the API when the token needs interaction", async () => {
        const { store, fetchFn } = createApiHarness(() => jsonResponse(200, []), { getAccessToken: async () => { throw new ApiAuthRequiredError(); } });
        const result = await store.dispatch(claimsApi.endpoints.listClaims.initiate());

        expect(result.error).toMatchObject({ kind: "unauthorized" });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("reports not configured without calling the API when the base URL is missing", async () => {
        const { store, fetchFn } = createApiHarness(() => jsonResponse(200, []), { baseUrl: "" });
        const result = await store.dispatch(claimsApi.endpoints.listClaims.initiate());

        expect(result.error).toMatchObject({ kind: "not_configured" });
        expect(fetchFn).not.toHaveBeenCalled();
    });
});
