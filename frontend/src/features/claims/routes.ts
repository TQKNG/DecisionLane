// Claim detail URLs are /claims/<id>/. Static export cannot pre-render every claim, so the host rewrites
// those paths to the /claims/detail/ shell (public/staticwebapp.config.json, and next.config.ts in development).

const RESERVED_SEGMENTS = new Set(["new", "detail"]);
const CLAIM_PATH_PATTERN = /^\/claims\/([^/]+)\/?$/;

export const CLAIMS_HOME = "/dashboard/";
export const NEW_CLAIM_PATH = "/claims/new/";

export function claimDetailHref(claimId: string): string {
    return `/claims/${encodeURIComponent(claimId)}/`;
}

export function claimIdFromPath(pathname: string | null | undefined): string | undefined {
    const match = pathname ? CLAIM_PATH_PATTERN.exec(pathname) : null;
    if (!match) return undefined;
    let claimId: string;
    try {
        claimId = decodeURIComponent(match[1]).trim();
    } catch {
        return undefined;
    }
    if (!claimId || RESERVED_SEGMENTS.has(claimId)) return undefined;
    return claimId;
}
