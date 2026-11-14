"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { useSession } from "./providers";
import { ENTRA_CONFIGURED, LOGIN_REQUEST } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
export function AppShell({ children }: {
    children: React.ReactNode;
}) {
    const session = useSession();
    const { instance } = useMsal();
    const pathname = usePathname();
    const page = session.authenticated || pathname === "/sign-in" ? children : <section className="surface welcome"><p className="eyebrow">SECURE WORKSPACE</p><h1 className="page-title">Sign in to continue.</h1><p className="page-subtitle">Connect your Microsoft Entra ID account to access the application.</p><div className="button-row"><Button disabled={!ENTRA_CONFIGURED} onClick={() => void instance.loginRedirect(LOGIN_REQUEST)}>Sign in with Microsoft</Button></div></section>;
    return <><a className="skip-link" href="#main-content">Skip to content</a><header className="app-header"><Link className="brand" href="/">RefundFlow<span className="brand-dot">.</span></Link><div className="header-account"><ThemeToggle /><span className="header-note">{session.authenticated ? session.name : "Secure workspace"}</span>{session.authenticated && <Button variant="outline" onClick={() => void instance.logoutRedirect()}>Sign out</Button>}</div></header><main id="main-content" className="app-main"><div className="content">{page}</div></main><footer className="app-footer">RefundFlow</footer></>;
}
