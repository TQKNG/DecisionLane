import type { Role } from "@/lib/types";
import { API_SCOPE, AUTH_CONFIGURED, MSAL_INSTANCE } from "@/lib/auth";
import { demoRequest } from "./demo";
export interface TransportSession {
    mode: "live" | "demo";
    role: Role;
    accountKey: string;
}
export async function transport(session: TransportSession, path: string, init: RequestInit = {}) {
    if (session.mode === "demo")
        return demoRequest(path, init, session.role, session.accountKey);
    if (!AUTH_CONFIGURED)
        throw new Error("Live service is not configured. Configure the public API and Microsoft sign-in settings, or explicitly enter demo mode.");
    const account = MSAL_INSTANCE.getAllAccounts().find(a => a.homeAccountId === session.accountKey);
    if (!account)
        throw new Error("Sign in with Microsoft to continue.");
    const token = await MSAL_INSTANCE.acquireTokenSilent({ account, scopes: [API_SCOPE] });
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.accessToken}`, ...init.headers } });
    if (!response.ok)
        throw new Error(`${response.status}: ${await response.text()}`);
    return response.status === 204 ? undefined : response.json();
}
