import { describe, expect, it } from "vitest";
import { formatAmount, formatClaimType, formatDateTime } from "@/features/claims/format";
import { CLAIM_STATUS_PRESENTATION, presentClaimStatus, sortClaimsByUpdated, summarizeClaims } from "@/features/claims/status";
import { CLAIM_STATUSES, type ClaimStatus, type RefundClaim } from "@/features/claims/types";

function claim(id: string, status: ClaimStatus, updatedAt: string): RefundClaim {
    return { id, customer_id: "customer-test-001", customer_email: "customer@example.test", order_id: `order-${id}`, claim_type: "wrong_item", reason: "Synthetic test reason.", requested_amount: "10.00", currency: "CAD", status, created_at: "2026-01-01T00:00:00Z", updated_at: updatedAt };
}

describe("claim status presentation", () => {
    it("covers every backend status with a label and description", () => {
        for (const status of CLAIM_STATUSES) {
            expect(CLAIM_STATUS_PRESENTATION[status].label).toBeTruthy();
            expect(CLAIM_STATUS_PRESENTATION[status].description).toBeTruthy();
        }
    });

    it("treats final statuses as not active", () => {
        for (const status of ["refunded", "rejected", "closed"] as const) expect(presentClaimStatus(status).active).toBe(false);
        for (const status of ["scanning", "processing", "pending_approval", "refund_submitted"] as const) expect(presentClaimStatus(status).active).toBe(true);
    });

    it("falls back to a readable label for unknown statuses", () => {
        expect(presentClaimStatus("future_status")).toMatchObject({ label: "future status", variant: "neutral", active: false });
    });
});

describe("claims list helpers", () => {
    const claims = [
        claim("a", "draft", "2026-01-01T00:00:00Z"),
        claim("b", "processing", "2026-01-03T00:00:00Z"),
        claim("c", "refunded", "2026-01-02T00:00:00Z"),
        claim("d", "needs_information", "2026-01-04T00:00:00Z"),
    ];

    it("summarizes claims by what the customer needs to know", () => {
        expect(summarizeClaims(claims)).toEqual({ total: 4, inProgress: 1, needsAction: 2, refunded: 1 });
    });

    it("sorts the most recently updated claim first", () => {
        expect(sortClaimsByUpdated(claims).map((item) => item.id)).toEqual(["d", "b", "c", "a"]);
    });

    it("formats amounts, claim types, and missing dates", () => {
        expect(formatAmount("not-a-number", "CAD")).toBe("not-a-number CAD");
        expect(formatAmount("12.5", "CAD")).toMatch(/12\.50/);
        expect(formatClaimType("damaged_item")).toBe("Damaged item");
        expect(formatDateTime(undefined)).toBe("Not available");
    });
});
