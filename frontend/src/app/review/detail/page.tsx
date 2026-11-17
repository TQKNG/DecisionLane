import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { ReviewDetailView } from "@/features/reviews/review-detail";
import { REVIEW_ROLES } from "@/lib/roles";

// Serves every /review/<id>/ URL through a host rewrite. See src/features/reviews/routes.ts.
export default function ReviewDetailPage() {
    return <AppShell><RoleGate allowed={REVIEW_ROLES}><ReviewDetailView /></RoleGate></AppShell>;
}
