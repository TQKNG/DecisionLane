"use client";

import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGIN_REQUEST } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();
  const authenticated = useIsAuthenticated();
  const pathname = usePathname();
  const roles = (accounts[0]?.idTokenClaims?.roles as string[] | undefined) ?? [];
  const staff = roles.includes("Reviewer") || roles.includes("Admin");
  const admin = roles.includes("Admin");
  if (!authenticated && pathname === "/sign-in") return <><header className="app-header"><Link className="brand" href="/">RefundFlow AI</Link><span className="header-note">Demo · Test payments</span></header><main className="app-main" style={{margin:0,minHeight:"calc(100vh - 76px)"}}><div className="content">{children}</div></main></>;
  if (!authenticated) return <><header className="app-header"><Link className="brand" href="/">RefundFlow AI</Link><span className="header-note">Demo · Test payments</span></header><main className="app-main" style={{margin:0,minHeight:"calc(100vh - 76px)"}}><div className="content"><section className="surface" style={{maxWidth:680,margin:"8vh auto"}}><p className="helper">SECURE CUSTOMER PORTAL</p><h1 className="page-title">Refund decisions with visible evidence.</h1><p className="page-subtitle" style={{marginTop:18}}>Submit supporting documents, follow each review step, and keep a human in control.</p><button className="button" onClick={() => instance.loginRedirect(LOGIN_REQUEST)}>Sign in with Microsoft</button></section></div></main></>;
  const links = staff ? [{href:"/reviews",label:"Review queue"},{href:"/claims",label:"Claims"},...(admin?[{href:"/admin",label:"Operations"}]:[])] : [{href:"/claims",label:"My claims"},{href:"/claims/new/issue",label:"New refund claim"}];
  return <><header className="app-header"><Link className="brand" href="/claims">RefundFlow AI</Link><span className="header-note">Demo · Test payments</span></header><aside className="app-rail"><span className="rail-label">{staff ? admin ? "Admin" : "Reviewer" : "Customer"}</span><nav className="rail-links" aria-label="Main navigation">{links.map(item=><Link key={item.href} href={item.href} aria-current={pathname===item.href?"page":undefined}>{item.label}</Link>)}<button className="mobile-signout" onClick={() => instance.logoutRedirect()}>Sign out</button></nav><div className="rail-bottom"><button className="issue-option" onClick={() => instance.logoutRedirect()}>Sign out</button></div></aside><main className="app-main"><div className="content">{children}</div></main></>;
}
