import { Badge } from "@/components/ui/badge";
import { presentClaimStatus } from "@/features/claims/status";

export function ClaimStatusBadge({ status }: { status: string }) {
    const presentation = presentClaimStatus(status);
    return <Badge variant={presentation.variant} title={presentation.description}><span className="dl-status-dot" aria-hidden="true" />{presentation.label}</Badge>;
}
