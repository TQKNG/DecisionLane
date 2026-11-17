import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { NewClaim } from "@/features/claims/new-claim";
import { CUSTOMER_ROLES } from "@/lib/roles";

export default function NewClaimPage() {
    return <AppShell><RoleGate allowed={CUSTOMER_ROLES}><NewClaim /></RoleGate></AppShell>;
}
