import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";

export default function HomePage() {
    return <AppShell>
        <header className="dl-page-head"><div><h1>Dashboard</h1><p>A clear view of decisions across your business processes.</p></div></header>
        <EmptyState title="Your workspace is ready" description="Cases and decisions will appear here when a workflow is connected." />
    </AppShell>;
}
