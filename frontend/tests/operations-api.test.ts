import { describe, expect, it } from "vitest";
import { operationsApi } from "@/features/operations/api";
import { EMPTY_ORDER_FORM, toCreateOrderRequest, validateOrderForm } from "@/features/operations/order-form";
import type { AdminKpis } from "@/features/operations/types";
import { createApiHarness, jsonResponse, TEST_BASE_URL } from "./support/api-harness";

const KPIS: AdminKpis = { total_claims: 4, pending_approval: 1, refunded: 2, rejected: 1, decision_rate: 0.75, by_status: { pending_approval: 1, refunded: 2, rejected: 1 } };
const ORDER_VALUES = { id: " order-test-002 ", customer_id: "customer-test-001", currency: "cad", paid_amount: "19.99", payment_intent_id: "pi_test_synthetic" };

describe("getAdminKpis", () => {
    it("loads claim metrics", async () => {
        const { store, requests } = createApiHarness(() => jsonResponse(200, KPIS));
        const result = await store.dispatch(operationsApi.endpoints.getAdminKpis.initiate());

        expect(result.data).toEqual(KPIS);
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/admin/kpis`);
    });

    it("reports a non-admin as forbidden", async () => {
        const { store } = createApiHarness(() => jsonResponse(403, { detail: "Insufficient role" }));
        const result = await store.dispatch(operationsApi.endpoints.getAdminKpis.initiate());

        expect(result.error).toMatchObject({ kind: "forbidden", status: 403 });
    });
});

describe("createTestOrder", () => {
    it("posts a normalized order", async () => {
        const { store, requests } = createApiHarness((request) => jsonResponse(201, JSON.parse(request.body)));
        const result = await store.dispatch(operationsApi.endpoints.createTestOrder.initiate(toCreateOrderRequest(ORDER_VALUES)));

        expect(requests[0].method).toBe("POST");
        expect(requests[0].url).toBe(`${TEST_BASE_URL}/v1/admin/orders`);
        expect(result.data).toEqual({ id: "order-test-002", customer_id: "customer-test-001", currency: "CAD", paid_amount: "19.99", payment_intent_id: "pi_test_synthetic" });
    });

    it("surfaces a duplicate order", async () => {
        const { store } = createApiHarness(() => jsonResponse(409, { detail: "Order order-test-002 already exists" }));
        const result = await store.dispatch(operationsApi.endpoints.createTestOrder.initiate(toCreateOrderRequest(ORDER_VALUES)));

        expect(result.error).toEqual({ kind: "conflict", status: 409, detail: "Order order-test-002 already exists" });
    });
});

describe("validateOrderForm", () => {
    it("accepts a complete order", () => {
        expect(validateOrderForm(ORDER_VALUES)).toEqual({});
    });

    it("flags every missing field", () => {
        expect(Object.keys(validateOrderForm({ ...EMPTY_ORDER_FORM, currency: "" })).sort()).toEqual(["currency", "customer_id", "id", "paid_amount", "payment_intent_id"]);
    });

    it.each(["0", "-1", "1.999", "abc"])("rejects the amount %s", (amount) => {
        expect(validateOrderForm({ ...ORDER_VALUES, paid_amount: amount }).paid_amount).toBeDefined();
    });

    it("rejects a currency that is not three letters", () => {
        expect(validateOrderForm({ ...ORDER_VALUES, currency: "CA1" }).currency).toBeDefined();
    });
});
