import { describe, expect, it } from "vitest";
import { navigationFor } from "@/lib/navigation";
import { hasAnyRole, homeForRoles, REVIEW_ROLES, rolesFromAccessToken, type AppRole } from "@/lib/roles";

function base64Url(value: string): string {
    return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function syntheticToken(claims: Record<string, unknown>): string {
    return `${base64Url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}.synthetic-signature`;
}

const roles = (...values: AppRole[]) => new Set<AppRole>(values);

describe("rolesFromAccessToken", () => {
    it("reads known app roles from the token payload", () => {
        expect([...rolesFromAccessToken(syntheticToken({ oid: "user-test-001", roles: ["Reviewer", "Admin"] }))]).toEqual(["Reviewer", "Admin"]);
    });

    it("ignores unknown roles and non-string values", () => {
        expect([...rolesFromAccessToken(syntheticToken({ roles: ["Customer", "Owner", 42] }))]).toEqual(["Customer"]);
    });

    it("decodes base64url payloads with multibyte characters", () => {
        expect([...rolesFromAccessToken(syntheticToken({ name: "Zoë Tester ✓", roles: ["Customer"] }))]).toEqual(["Customer"]);
    });

    it.each([
        ["an empty string", ""],
        ["a token without a payload", "header-only"],
        ["a payload that is not JSON", "a.bm90LWpzb24.c"],
        ["a payload without roles", syntheticToken({ oid: "user-test-001" })],
        ["a roles claim that is not a list", syntheticToken({ roles: "Admin" })],
    ])("returns no roles for %s", (_label, token) => {
        expect(rolesFromAccessToken(token).size).toBe(0);
    });
});

describe("role helpers", () => {
    it("matches any of the allowed roles", () => {
        expect(hasAnyRole(roles("Admin"), REVIEW_ROLES)).toBe(true);
        expect(hasAnyRole(roles("Customer"), REVIEW_ROLES)).toBe(false);
    });

    it.each([
        [roles("Customer", "Admin"), "/dashboard/"],
        [roles("Reviewer"), "/review/"],
        [roles("Admin"), "/review/"],
        [roles(), undefined],
    ])("chooses the landing page for each role set", (value, home) => {
        expect(homeForRoles(value)).toBe(home);
    });
});

describe("navigationFor", () => {
    const labels = (value: ReadonlySet<AppRole>, status: "loading" | "ready" | "unavailable" = "ready") => navigationFor(value, status).map((item) => item.label);

    it("shows each screen only to its roles", () => {
        expect(labels(roles("Customer"))).toEqual(["Claims"]);
        expect(labels(roles("Reviewer"))).toEqual(["Review queue"]);
        expect(labels(roles("Admin"))).toEqual(["Review queue", "Operations"]);
        expect(labels(roles("Customer", "Reviewer", "Admin"))).toEqual(["Claims", "Review queue", "Operations"]);
    });

    it("falls back to the customer view while roles are unknown", () => {
        expect(labels(roles(), "loading")).toEqual(["Claims"]);
        expect(labels(roles(), "unavailable")).toEqual(["Claims"]);
    });

    it("marks the current section from the path", () => {
        const [review] = navigationFor(roles("Reviewer"), "ready");
        expect(review.matches("/review/claim-test-001/")).toBe(true);
        expect(review.matches("/dashboard/")).toBe(false);
    });
});
