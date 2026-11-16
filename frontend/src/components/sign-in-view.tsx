"use client";

import Link from "next/link";
import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { DecisionLaneBrand, DecisionLaneFlowArt } from "@/components/decision-lane-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { useSession } from "@/components/providers";
import { API_CONFIGURED, ENTRA_CONFIGURED, loginRequestFor, SIGNED_IN_HOME } from "@/lib/auth";

export function SignInView() {
    const { instance } = useMsal();
    const session = useSession();
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    async function signIn() {
        setError("");
        setPending(true);
        try {
            await instance.loginRedirect(loginRequestFor(window.location.pathname));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Sign-in could not be started. Please try again.");
            setPending(false);
        }
    }

    return <div className="dl-auth">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="dl-auth-header"><DecisionLaneBrand /><ThemeToggle /></header>
        <main id="main-content" className="dl-auth-main">
            <section className="dl-auth-art" aria-label="Welcome">
                <h1>Welcome back.</h1>
                <p>Pick up where your decisions left off.</p>
                <DecisionLaneFlowArt />
            </section>
            <Card className="dl-auth-card">
                <h2>{session.authenticated ? "You are signed in" : "Sign in"}</h2>
                <p>{session.authenticated ? "Your claims are ready." : "Track your refund claims and their progress."}</p>
                {error && <Notice variant="destructive">{error}</Notice>}
                {!ENTRA_CONFIGURED && !session.authenticated && <Notice variant="warning">Microsoft Entra ID is not configured for this workspace.</Notice>}
                {ENTRA_CONFIGURED && !API_CONFIGURED && <Notice variant="warning">The DecisionLane API is not configured, so claims cannot be loaded yet.</Notice>}
                {session.authenticated ? <Button className="dl-auth-action" size="pill" asChild><Link href={SIGNED_IN_HOME}>View your claims</Link></Button> : <Button className="dl-auth-action" size="pill" disabled={!ENTRA_CONFIGURED || pending} onClick={() => void signIn()}>{pending ? "Opening Microsoft sign-in..." : "Continue with Microsoft"}</Button>}
                {!session.authenticated && <p className="dl-auth-help">Use your organization account to continue securely.</p>}
            </Card>
        </main>
        <footer className="dl-auth-footer"><span>© 2026 DecisionLane</span><span>Secure workspace</span></footer>
    </div>;
}
