"use client";
import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { AppShell } from "@/components/app-shell";
import { ENTRA_CONFIGURED, LOGIN_REQUEST } from "@/lib/auth";
import { Button } from "@/components/ui/button";
export default function SignInPage() { const { instance } = useMsal(); const [error, setError] = useState(""); return <AppShell><section className="surface welcome"><p className="eyebrow">SECURE WORKSPACE</p><h1 className="page-title">Sign in to continue.</h1><p className="page-subtitle">Use your Microsoft Entra ID account to access RefundFlow.</p>{error && <p role="alert" className="error-summary">{error}</p>}<div className="button-row"><Button disabled={!ENTRA_CONFIGURED} onClick={() => instance.loginRedirect(LOGIN_REQUEST).catch(error => setError(String(error)))}>Sign in with Microsoft</Button></div>{!ENTRA_CONFIGURED && <p className="helper">Configure the Entra client and tenant environment variables first.</p>}</section></AppShell>; }
