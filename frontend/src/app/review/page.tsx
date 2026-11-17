import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { ReviewQueue } from "@/features/reviews/review-queue";
import { REVIEW_ROLES } from "@/lib/roles";

export default function ReviewQueuePage() {
    return <AppShell><RoleGate allowed={REVIEW_ROLES}><ReviewQueue /></RoleGate></AppShell>;
}
