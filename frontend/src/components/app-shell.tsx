"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { useSession } from "./providers";
import { AUTH_CONFIGURED, LOGIN_REQUEST } from "@/lib/auth";
import { Button } from "./ui/button";
import type { Role } from "@/lib/types";
export function AppShell({ children }: {
    children: React.ReactNode;
}) {
    const session = useSession();
    const { instance } = useMsal();
    const pathname = usePathname();
    const staff = session.authenticated && session.role !== "Customer";
    const links = staff ? [{ href: "/reviews", label: "Review queue" }, { href: "/claims", label: "All claims" }, ...(session.role === "Admin" ? [{ href: "/admin", label: "Operations" }] : [])] : [{ href: "/claims", label: "My claims" }, { href: "/claims/new/issue", label: "Start a claim" }];
    return <><a className="skip-link" href="#main-content">Skip to content</a><header className="app-header"><Link className="brand" href="/">RefundFlow<span className="brand-dot">.</span></Link><div className="header-account"><span className="header-note">{session.authenticated ? session.name : "Evidence. Review. Resolution."}</span>{session.authenticated && <Button variant="secondary" onClick={() => session.mode === "demo" ? session.exitDemo() : void instance.logoutRedirect()}>Sign out</Button>}</div></header>{session.mode === "demo" && <div className="demo-bar"><strong>Demo workspace</strong><span>Synthetic data · No payments</span><label>Role <select aria-label="Demo role" value={session.role} onChange={event => session.setDemo(event.target.value as Role)}><option>Customer</option><option>Reviewer</option><option>Admin</option></select></label>{session.role === "Reviewer" && <Button variant="secondary" onClick={() => session.setDemo("Reviewer", session.accountKey.endsWith("A") ? "B" : "A")}>Switch reviewer identity</Button>}<Button variant="secondary" onClick={session.reset}>Reset demo</Button></div>}{session.authenticated && <nav className={staff ? "app-rail" : "customer-nav"} aria-label="Main navigation">{staff && <span className="rail-label">{session.role} workspace</span>}<div className="rail-links">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</div>{staff && <p className="helper rail-bottom">Human decisions.<br />Clear audit trails.</p>}</nav>}{session.resetError && <p role="alert" className="error-summary">{session.resetError}</p>}<main id="main-content" className={`app-main ${staff ? "staff-main" : "customer-main"}`}><div className="content">{session.authenticated || pathname === "/sign-in" ? children : <section className="surface welcome"><p className="eyebrow">CUSTOMER RESOLUTION PORTAL</p><h1 className="page-title">A clear path to your refund.</h1><p className="page-subtitle">Share what happened, add your evidence, and follow every step of the review.</p><div className="button-row"><Button disabled={!AUTH_CONFIGURED} onClick={() => void instance.loginRedirect(LOGIN_REQUEST)}>Sign in with Microsoft</Button><Button variant="secondary" onClick={() => session.setDemo("Customer")}>Explore demo</Button></div><p className="helper">Every decision is reviewed by a person.</p></section>}</div></main><footer className="app-footer">RefundFlow · Evidence-grounded decisions</footer></>;
}
