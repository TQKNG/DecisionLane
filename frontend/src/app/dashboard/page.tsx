import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { ClaimsList } from "@/features/claims/claims-list";
import { CUSTOMER_ROLES } from "@/lib/roles";

// The signed-in landing page. Reviewers and Admins without the Customer role are sent to their own workspace.
export default function DashboardPage() {
    return <AppShell><RoleGate allowed={CUSTOMER_ROLES} redirectWhenDenied><ClaimsList /></RoleGate></AppShell>;
}
