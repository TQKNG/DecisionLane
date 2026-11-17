"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { hasAnyRole, homeForRoles, type AppRole } from "@/lib/roles";

export interface RoleGateProps {
    allowed: readonly AppRole[];
    /** Sends a signed-in user without access to their own landing page instead of showing the access message. */
    redirectWhenDenied?: boolean;
    children: React.ReactNode;
}

/**
 * Shows a screen only to users with one of the allowed app roles.
 * When roles cannot be read from the API token, the screen renders and the API's own authorization errors explain access.
 */
export function RoleGate({ allowed, redirectWhenDenied = false, children }: RoleGateProps) {
    const { roles, rolesStatus } = useSession();
    const router = useRouter();
    const allowedHere = rolesStatus === "unavailable" || hasAnyRole(roles, allowed);
    const home = homeForRoles(roles);
    const redirecting = rolesStatus === "ready" && !allowedHere && redirectWhenDenied && Boolean(home);

    useEffect(() => {
        if (redirecting && home) router.replace(home);
    }, [redirecting, home, router]);

    if (rolesStatus === "loading") return <LoadingState message="Checking your access..." />;
    if (allowedHere) return children;
    if (redirecting) return <LoadingState message="Opening your workspace..." />;
    return <EmptyState
        title="You do not have access"
        description="Your account is not assigned the role this page needs. Ask your administrator for access, or go back to your workspace."
        action={home ? <Button asChild variant="outline" size="pill"><Link href={home}>Go to your workspace</Link></Button> : undefined}
    />;
}
