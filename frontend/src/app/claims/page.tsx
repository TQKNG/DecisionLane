"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ClaimRow, ClaimsTable } from "@/components/claims-table";
import { useApi } from "@/lib/api";

export default function ClaimsPage() {
  const { request } = useApi();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    request<ClaimRow[]>("/v1/claims").then(setClaims).catch((value) => setError(String(value)));
  }, [request]);
  return <AppShell><h1 className="mb-8 text-3xl font-semibold">Claims</h1>{error ? <p>{error}</p> : <ClaimsTable claims={claims} />}</AppShell>;
}