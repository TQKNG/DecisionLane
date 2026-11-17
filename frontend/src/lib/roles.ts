// Entra app roles defined on the DecisionLane API registration. The backend enforces them on every request
// (backend/api/auth.py). The client reads them only to choose which screens and navigation to show.

export const APP_ROLES = ["Customer", "Reviewer", "Admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** `unavailable` means the API token could not be read, so screens fall back to the API's own authorization errors. */
export type RolesStatus = "loading" | "ready" | "unavailable";

export const CUSTOMER_ROLES: readonly AppRole[] = ["Customer"];
export const REVIEW_ROLES: readonly AppRole[] = ["Reviewer", "Admin"];
export const OPERATIONS_ROLES: readonly AppRole[] = ["Admin"];

export const CUSTOMER_HOME = "/dashboard/";
export const REVIEW_HOME = "/review/";
export const OPERATIONS_HOME = "/operations/";

function isAppRole(value: unknown): value is AppRole {
    return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

function decodeBase64Url(segment: string): string {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

/**
 * Reads the `roles` claim from an API access token without verifying its signature.
 * Returns an empty set for a malformed token or a token without known roles.
 */
export function rolesFromAccessToken(token: string): ReadonlySet<AppRole> {
    const payload = token.split(".")[1];
    if (!payload) return new Set();
    try {
        const claims: unknown = JSON.parse(decodeBase64Url(payload));
        const roles = claims && typeof claims === "object" && "roles" in claims ? (claims as { roles: unknown }).roles : undefined;
        return new Set(Array.isArray(roles) ? roles.filter(isAppRole) : []);
    } catch {
        return new Set();
    }
}

export function hasAnyRole(roles: ReadonlySet<AppRole>, allowed: readonly AppRole[]): boolean {
    return allowed.some((role) => roles.has(role));
}

/** Chooses the landing page for a signed-in user, preferring the customer view, then review, then operations. */
export function homeForRoles(roles: ReadonlySet<AppRole>): string | undefined {
    if (hasAnyRole(roles, CUSTOMER_ROLES)) return CUSTOMER_HOME;
    if (hasAnyRole(roles, REVIEW_ROLES)) return REVIEW_HOME;
    if (hasAnyRole(roles, OPERATIONS_ROLES)) return OPERATIONS_HOME;
    return undefined;
}
