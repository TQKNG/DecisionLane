"use client";

import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { OperationsWorkspace } from "@/features/operations/operations-workspace";

export default function AdminPage() {
  return (
    <AppShell>
      <Suspense fallback={<section className="surface" role="status">Loading operations workspace...</section>}>
        <OperationsWorkspace />
      </Suspense>
    </AppShell>
  );
}
