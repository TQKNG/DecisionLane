import { AppShell } from "@/components/app-shell";

export default function HomePage() {
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Welcome to RefundFlow AI</h1>
      <p className="mt-3 text-slate-300">
        Use the navigation to submit a claim or review the operations queue.
      </p>
    </AppShell>
  );
}