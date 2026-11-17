import { InteractionRequiredAuthError, PublicClientApplication, type RedirectRequest } from "@azure/msal-browser";
import { ApiAuthRequiredError } from "@/lib/api/base-query";
export const ENTRA_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID && process.env.NEXT_PUBLIC_ENTRA_TENANT_ID);
export const API_SCOPE = process.env.NEXT_PUBLIC_API_SCOPE || "";
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
export const API_CONFIGURED = Boolean(API_BASE_URL && API_SCOPE);
export const LOGIN_REQUEST = { scopes: ["openid", "profile", "email", ...(API_SCOPE ? [API_SCOPE] : [])] };
export const SIGNED_IN_HOME = "/dashboard/";
export const MSAL_INSTANCE = new PublicClientApplication({ auth: { clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID || "00000000-0000-0000-0000-000000000000", authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ENTRA_TENANT_ID || "common"}`, redirectUri: typeof window === "undefined" ? undefined : window.location.origin }, cache: { cacheLocation: "sessionStorage" } });

/** Builds a login request that returns to the claims list from public pages and to the current page elsewhere. */
export function loginRequestFor(pathname: string): RedirectRequest {
    const isPublicPage = pathname === "/" || pathname.startsWith("/sign-in");
    return isPublicPage ? { ...LOGIN_REQUEST, redirectStartPage: new URL(SIGNED_IN_HOME, window.location.origin).href } : LOGIN_REQUEST;
}

/** Returns an access token for the DecisionLane API, or throws ApiAuthRequiredError when the user must sign in again. */
export async function acquireApiToken(): Promise<string> {
    const account = MSAL_INSTANCE.getActiveAccount() ?? MSAL_INSTANCE.getAllAccounts()[0];
    if (!account || !API_SCOPE) throw new ApiAuthRequiredError();
    try {
        return (await MSAL_INSTANCE.acquireTokenSilent({ scopes: [API_SCOPE], account })).accessToken;
    } catch (cause) {
        if (cause instanceof InteractionRequiredAuthError) throw new ApiAuthRequiredError();
        throw cause;
    }
}
