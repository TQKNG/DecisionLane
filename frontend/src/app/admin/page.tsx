"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { useApi } from "@/lib/api";

interface Kpis {
  total_claims: number;
  pending_approval: number;
  refunded: number;
  rejected: number;
  decision_rate: number;
}

export default function AdminPage() {
  const { request } = useApi();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  useEffect(() => {
    request<Kpis>("/v1/admin/kpis").then(setKpis);
  }, [request]);
  const cards = kpis ? [
    ["Total claims", kpis.total_claims], ["Pending", kpis.pending_approval],
    ["Refunded", kpis.refunded], ["Rejected", kpis.rejected],
    ["Decision rate", `${Math.round(kpis.decision_rate * 100)}%`],
  ] : [];
  return <AppShell><h1 className="text-3xl font-semibold">Operations</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, value]) => <section key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></section>)}</div></AppShell>;
}