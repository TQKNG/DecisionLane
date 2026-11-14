"use client";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "react-redux";
import { ENTRA_CONFIGURED, MSAL_INSTANCE } from "@/lib/auth";
import { makeStore } from "@/lib/store";
import { ThemeProvider } from "@/components/theme-provider";
export interface Session {
    authenticated: boolean;
    name: string;
    userId: string;
}
const SESSION = createContext<Session | null>(null);
export function useSession() { const session = useContext(SESSION); if (!session)
    throw new Error("Session provider missing"); return session; }
function StoreBoundary({ children }: {
    children: React.ReactNode;
}) { const [store] = useState(makeStore); return <Provider store={store}>{children}</Provider>; }
function SessionProvider({ children }: {
    children: React.ReactNode;
}) {
    const { accounts } = useMsal();
    const account = accounts[0];
    const accountKey = account?.homeAccountId || "anonymous";
    const session: Session = { userId: String(account?.idTokenClaims?.oid || account?.idTokenClaims?.sub || account?.localAccountId || accountKey), authenticated: Boolean(account), name: account?.name || "Guest" };
    return <SESSION.Provider value={session}><StoreBoundary key={accountKey}>{children}</StoreBoundary></SESSION.Provider>;
}
export function Providers({ children }: {
    children: React.ReactNode;
}) {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => { MSAL_INSTANCE.initialize().then(() => MSAL_INSTANCE.handleRedirectPromise()).then(() => setReady(true)).catch(error => setError(String(error))); }, []);
    const content = useMemo(() => ready ? <MsalProvider instance={MSAL_INSTANCE}><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><SessionProvider>{children}</SessionProvider></ThemeProvider></MsalProvider> : null, [ready, children]);
    if (error)
        return <main className="surface" role="alert">Sign-in initialization failed: {error}<button className="button" onClick={() => location.reload()}>Retry</button></main>;
    if (!ready)
        return <main className="surface" role="status">Preparing your secure workspace...</main>;
    return <>{!ENTRA_CONFIGURED && <div className="config-note">Microsoft Entra ID is not configured. Add the public client and tenant settings to enable sign-in.</div>}{content}</>;
}
