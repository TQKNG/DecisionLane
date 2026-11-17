import type { ClaimType } from "@/features/claims/types";

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
    delayed_delivery: "Delayed delivery",
    non_delivery: "Not delivered",
    damaged_item: "Damaged item",
    wrong_item: "Wrong item",
};

export function formatClaimType(claimType: string): string {
    return CLAIM_TYPE_LABELS[claimType as ClaimType] ?? claimType.replace(/_/g, " ");
}

export function formatAmount(amount: string, currency: string): string {
    const value = Number(amount);
    if (!Number.isFinite(value)) return `${amount} ${currency}`;
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
        return `${amount} ${currency}`;
    }
}

export function formatDateTime(value: string | undefined): string {
    const time = value ? Date.parse(value) : Number.NaN;
    if (Number.isNaN(time)) return "Not available";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(time);
}
