// Review detail URLs are /review/<claim id>/. Static export cannot pre-render every claim, so the host rewrites
// those paths to the /review/detail/ shell (public/staticwebapp.config.json, and next.config.ts in development).

import { REVIEW_HOME } from "@/lib/roles";

const RESERVED_SEGMENTS = new Set(["detail"]);
const REVIEW_PATH_PATTERN = /^\/review\/([^/]+)\/?$/;

export { REVIEW_HOME };

export function reviewDetailHref(claimId: string): string {
    return `${REVIEW_HOME}${encodeURIComponent(claimId)}/`;
}

export function claimIdFromReviewPath(pathname: string | null | undefined): string | undefined {
    const match = pathname ? REVIEW_PATH_PATTERN.exec(pathname) : null;
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
