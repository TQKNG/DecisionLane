"use client";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Provider } from "react-redux";
import { acquireApiToken, API_BASE_URL, API_CONFIGURED, MSAL_INSTANCE } from "@/lib/auth";
import { rolesFromAccessToken, type AppRole, type RolesStatus } from "@/lib/roles";
import { makeStore } from "@/lib/store";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
export interface Session {
    authenticated: boolean;
    name: string;
    userId: string;
    roles: ReadonlySet<AppRole>;
    rolesStatus: RolesStatus;
}
const NO_ROLES: ReadonlySet<AppRole> = new Set();
const SESSION = createContext<Session | null>(null);
export function useSession() { const session = useContext(SESSION); if (!session)
    throw new Error("Session provider missing"); return session; }
function StoreBoundary({ children }: {
    children: React.ReactNode;
}) { const [store] = useState(() => makeStore({ baseUrl: API_CONFIGURED ? API_BASE_URL : "", getAccessToken: acquireApiToken })); return <Provider store={store}>{children}</Provider>; }
function SessionProvider({ children }: {
    children: React.ReactNode;
}) {
    const { accounts } = useMsal();
    const account = accounts[0];
    const accountKey = account?.homeAccountId || "anonymous";
    const hasAccount = Boolean(account);
    const [roleState, setRoleState] = useState<{ accountKey: string; roles: ReadonlySet<AppRole>; status: RolesStatus } | null>(null);
    useEffect(() => {
        if (!hasAccount || !API_CONFIGURED) return;
        let cancelled = false;
        acquireApiToken()
            .then((token) => { if (!cancelled) setRoleState({ accountKey, roles: rolesFromAccessToken(token), status: "ready" }); })
            .catch(() => { if (!cancelled) setRoleState({ accountKey, roles: NO_ROLES, status: "unavailable" }); });
        return () => { cancelled = true; };
    }, [hasAccount, accountKey]);
    const currentRoles = roleState?.accountKey === accountKey ? roleState : null;
    const rolesStatus: RolesStatus = !hasAccount || !API_CONFIGURED ? "unavailable" : currentRoles?.status ?? "loading";
    const session: Session = { userId: String(account?.idTokenClaims?.oid || account?.idTokenClaims?.sub || account?.localAccountId || accountKey), authenticated: Boolean(account), name: account?.name || "Guest", roles: currentRoles?.roles ?? NO_ROLES, rolesStatus };
    return <SESSION.Provider value={session}><StoreBoundary key={accountKey}>{children}</StoreBoundary></SESSION.Provider>;
}
export function Providers({ children }: {
    children: React.ReactNode;
}) {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => { MSAL_INSTANCE.initialize().then(() => MSAL_INSTANCE.handleRedirectPromise()).then(() => setReady(true)).catch(() => setError("We could not prepare sign-in. Please try again.")); }, []);
    let content: React.ReactNode;
    if (error) content = <main className="dl-initialization"><div><Notice variant="destructive">{error}</Notice><Button onClick={() => location.reload()}>Retry</Button></div></main>;
    else if (!ready) content = <main className="dl-initialization"><LoadingState message="Preparing your secure workspace..." /></main>;
    else content = <MsalProvider instance={MSAL_INSTANCE}><SessionProvider>{children}</SessionProvider></MsalProvider>;
    return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{content}</ThemeProvider>;
}
