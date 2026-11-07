"use client";
import { useMsal } from "@azure/msal-react";
import { AppShell } from "@/components/app-shell";
import { LOGIN_REQUEST } from "@/lib/auth";
export default function SignInPage(){const {instance}=useMsal();return <AppShell><section className="surface" style={{maxWidth:680,margin:"8vh auto"}}><p className="helper">SECURE CUSTOMER PORTAL</p><h1 className="page-title">Refund decisions with visible evidence.</h1><p className="page-subtitle" style={{marginTop:18}}>Submit supporting documents, follow each review step, and keep a human in control.</p><button className="button" onClick={()=>instance.loginRedirect(LOGIN_REQUEST)}>Sign in with Microsoft</button></section></AppShell>}
