import { AppShell } from "@/components/app-shell";
import { ClaimsList } from "@/features/claims/claims-list";

export default function DashboardPage() {
    return <AppShell><ClaimsList /></AppShell>;
}
