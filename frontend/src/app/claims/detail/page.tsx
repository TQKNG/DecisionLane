import { AppShell } from "@/components/app-shell";
import { ClaimDetail } from "@/features/claims/claim-detail";

// Serves every /claims/<id>/ URL through a host rewrite. See src/features/claims/routes.ts.
export default function ClaimDetailPage() {
    return <AppShell><ClaimDetail /></AppShell>;
}
