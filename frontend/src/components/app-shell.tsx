"use client";
import { useMsal } from "@azure/msal-react";
import { useState } from "react";
import { useSession } from "@/components/providers";
import { DecisionLaneBrand } from "@/components/decision-lane-brand";
import { SignInView } from "@/components/sign-in-view";
import { Button } from "@/components/ui/button";
import { Navigation, NavigationLink } from "@/components/ui/navigation";
import { Notice } from "@/components/ui/notice";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
    const session = useSession();
    const { instance } = useMsal();
    const [signOutError, setSignOutError] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    async function signOut() {
        setSignOutError(false);
        setSigningOut(true);
        try {
            await instance.logoutRedirect();
        } catch {
            setSignOutError(true);
            setSigningOut(false);
        }
    }

    if (!session.authenticated) return <SignInView />;

    const initials = session.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

    return <div className="dl-app">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <aside className="dl-sidebar">
            <DecisionLaneBrand />
            <Navigation><NavigationLink href="/" current>Home</NavigationLink></Navigation>
            <div className="dl-sidebar-bottom"><div className="dl-user"><span className="dl-avatar" aria-hidden="true">{initials}</span><span>{session.name}</span></div></div>
        </aside>
        <div className="dl-workspace">
            <header className="dl-topbar"><ThemeToggle /><Button variant="outline" size="sm" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out..." : "Sign out"}</Button></header>
            <main id="main-content" className="dl-content">{signOutError && <Notice variant="destructive">Could not sign out. Please try again.</Notice>}{children}</main>
        </div>
    </div>;
}
