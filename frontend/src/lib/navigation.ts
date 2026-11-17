import { CUSTOMER_HOME, CUSTOMER_ROLES, hasAnyRole, OPERATIONS_HOME, OPERATIONS_ROLES, REVIEW_HOME, REVIEW_ROLES, type AppRole, type RolesStatus } from "@/lib/roles";

export interface NavigationItem {
    label: string;
    href: string;
    roles: readonly AppRole[];
    matches: (pathname: string) => boolean;
}

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
    { label: "Claims", href: CUSTOMER_HOME, roles: CUSTOMER_ROLES, matches: (pathname) => pathname.startsWith("/dashboard") || pathname.startsWith("/claims") },
    { label: "Review queue", href: REVIEW_HOME, roles: REVIEW_ROLES, matches: (pathname) => pathname.startsWith("/review") },
    { label: "Operations", href: OPERATIONS_HOME, roles: OPERATIONS_ROLES, matches: (pathname) => pathname.startsWith("/operations") },
];

/** Lists the screens a user can open. Without readable roles, only the customer view is offered and the API explains access. */
export function navigationFor(roles: ReadonlySet<AppRole>, rolesStatus: RolesStatus): readonly NavigationItem[] {
    if (rolesStatus !== "ready") return NAVIGATION_ITEMS.filter((item) => item.href === CUSTOMER_HOME);
    return NAVIGATION_ITEMS.filter((item) => hasAnyRole(roles, item.roles));
}
