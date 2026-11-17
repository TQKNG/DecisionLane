import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { OperationsDashboard } from "@/features/operations/operations-dashboard";
import { OPERATIONS_ROLES } from "@/lib/roles";

export default function OperationsPage() {
    return <AppShell><RoleGate allowed={OPERATIONS_ROLES}><OperationsDashboard /></RoleGate></AppShell>;
}
