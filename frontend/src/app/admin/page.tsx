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
  const cards = kpis ? [["Total claims", kpis.total_claims], ["Pending approval", kpis.pending_approval], ["Refunded", kpis.refunded], ["Rejected", kpis.rejected], ["Decision rate", kpis.total_claims===0?"No decisions yet":`${((kpis.refunded+kpis.rejected)/kpis.total_claims*100).toFixed(1)}%`]] : [];
  return <AppShell><h1 className="page-title">Operations</h1><p className="page-subtitle">Current claims · illustrative demo metrics</p>{!kpis?<section className="surface" role="status">Loading operations metrics…</section>:<><div className="metrics">{cards.map(([label,value])=><section key={String(label)} className="metric"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></section>)}</div><section className="surface" style={{minHeight:250}}><h2 className="section-title">Decision rate</h2><p>(Refunded + Rejected) ÷ Total claims = ({kpis.refunded} + {kpis.rejected}) ÷ {kpis.total_claims} = {kpis.total_claims===0?"No decisions yet":`${((kpis.refunded+kpis.rejected)/kpis.total_claims*100).toFixed(1)}%`}</p><p className="helper">Metric period and source must be confirmed before production use.</p></section></>}</AppShell>;
}
