"use client";

import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import Link from "next/link";

import { LOGIN_REQUEST } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const roles = (accounts[0]?.idTokenClaims?.roles as string[] | undefined) ?? [];

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6">
        <section className="rounded-3xl border border-slate-700 bg-slate-900 p-10 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-400">
            RefundFlow AI
          </p>
          <h1 className="text-4xl font-semibold">Refund decisions with visible evidence.</h1>
          <p className="mt-4 max-w-xl text-slate-300">
            Upload supporting documents, follow validation, and keep a human in control.
          </p>
          <button
            className="mt-8 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950"
            onClick={() => instance.loginRedirect(LOGIN_REQUEST)}
          >
            Sign in with Microsoft
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/90">
        <nav className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <Link href="/" className="mr-auto text-xl font-semibold text-cyan-400">RefundFlow</Link>
          <Link href="/claims">Claims</Link>
          {roles.includes("Customer") && <Link href="/claims/new">New claim</Link>}
          {(roles.includes("Reviewer") || roles.includes("Admin")) && (
            <Link href="/reviews">Reviews</Link>
          )}
          {roles.includes("Admin") && <Link href="/admin">Admin</Link>}
          <button className="text-sm text-slate-300" onClick={() => instance.logoutRedirect()}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}