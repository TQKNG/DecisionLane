"use client";
import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { AUTH_CONFIGURED, LOGIN_REQUEST } from "@/lib/auth";
export default function SignInPage() { const { instance } = useMsal(); const session = useSession(); const router = useRouter(); const [error, setError] = useState(""); return <AppShell><section className="surface welcome"><p className="eyebrow">SECURE CUSTOMER PORTAL</p><h1 className="page-title">A clear path to your refund.</h1><p className="page-subtitle">Share your evidence. Follow the review. Know what comes next.</p>{error && <p role="alert" className="error-summary">{error}</p>}<div className="button-row"><Button disabled={!AUTH_CONFIGURED} onClick={() => instance.loginRedirect(LOGIN_REQUEST).catch(error => setError(String(error)))}>Sign in with Microsoft</Button><Button variant="secondary" onClick={() => { session.setDemo("Customer"); router.push("/claims"); }}>Explore demo</Button></div><p className="helper">Demo uses synthetic data and never processes a payment.</p></section></AppShell>; }
