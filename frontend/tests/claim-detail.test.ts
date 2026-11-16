import { describe, expect, it } from "vitest";
import { claimsApi } from "@/features/claims/api";
import { claimDetailHref, claimIdFromPath } from "@/features/claims/routes";
import { CLAIM_POLL_INTERVAL_MS, claimStatusStep, shouldPollClaim } from "@/features/claims/status";
import { CLAIM_STATUSES } from "@/features/claims/types";
import { createApiHarness, jsonResponse, TEST_BASE_URL, TEST_TOKEN } from "./support/api-harness";

describe("getClaim", () => {
    it("requests one claim with a bearer token", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, { id: "claim-test-001", status: "processing" }));
        const result = await store.dispatch(claimsApi.endpoints.getClaim.initiate("claim-test-001"));

        expect(result.data).toMatchObject({ id: "claim-test-001" });
        expect(requests[0].method).toBe("GET");
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/claims/claim-test-001`);
        expect(requests[0].headers.get("Authorization")).toBe(`Bearer ${TEST_TOKEN}`);
    });

    it("encodes the claim identifier", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, {}));
        await store.dispatch(claimsApi.endpoints.getClaim.initiate("a/b?c"));

        expect(new URL(requests[0].url).pathname).toBe("/v1/claims/a%2Fb%3Fc");
    });

    it.each([
        [404, "not_found"],
        [403, "forbidden"],
        [401, "unauthorized"],
    ] as const)("maps %i to %s", async (status, kind) => {
        const { store } = createApiHarness(() => jsonResponse(status, { detail: "Synthetic detail." }));
        const result = await store.dispatch(claimsApi.endpoints.getClaim.initiate("claim-test-001"));

        expect(result.error).toMatchObject({ kind, status });
    });
});

describe("claim detail routes", () => {
    it("round-trips identifiers through the detail URL", () => {
        for (const claimId of ["claim-test-001", "3f2b9c1e-0000-4000-8000-000000000000", "a b/c"]) {
            expect(claimIdFromPath(claimDetailHref(claimId))).toBe(claimId);
        }
    });

    it.each(["/claims/new/", "/claims/detail/", "/claims/", "/claims/a/b/", "/dashboard/", "/claims/%E0%A4%A/", "", null])("ignores %s", (pathname) => {
        expect(claimIdFromPath(pathname)).toBeUndefined();
    });

    it("accepts a path without the trailing slash", () => {
        expect(claimIdFromPath("/claims/claim-test-001")).toBe("claim-test-001");
    });
});

describe("claim progress", () => {
    it("polls every 3 seconds only while the backend is working", () => {
        expect(CLAIM_POLL_INTERVAL_MS).toBe(3000);
        expect(CLAIM_STATUSES.filter(shouldPollClaim)).toEqual(["scanning", "processing", "pending_approval", "approved", "refund_submitted", "pending_ai_capacity"]);
        expect(shouldPollClaim(undefined)).toBe(false);
    });

    it("places every status on a step", () => {
        for (const status of CLAIM_STATUSES) {
            const step = claimStatusStep(status);
            expect(step.current).toBeGreaterThanOrEqual(0);
            expect(step.current).toBeLessThanOrEqual(4);
        }
        expect(claimStatusStep("refunded")).toEqual({ current: 4, tone: "complete" });
        expect(claimStatusStep("rejected")).toEqual({ current: 3, tone: "stopped" });
        expect(claimStatusStep("needs_information")).toEqual({ current: 1, tone: "attention" });
    });
});
