"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { ClaimRow, ClaimsTable } from "@/components/claims-table";
import { useApi } from "@/lib/api";

export default function ReviewsPage() {
  const { request } = useApi();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  useEffect(() => {
    request<ClaimRow[]>("/v1/claims?status=pending_approval").then(setClaims);
  }, [request]);
  return <AppShell><h1 className="mb-8 text-3xl font-semibold">Review queue</h1><ClaimsTable claims={claims} reviewMode /></AppShell>;
}