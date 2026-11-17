import type { ClaimsSummary as ClaimsSummaryValues } from "@/features/claims/status";

export function ClaimsSummary({ summary }: { summary: ClaimsSummaryValues }) {
    const metrics = [
        { label: "Total claims", value: summary.total, icon: <path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" /> },
        { label: "In progress", value: summary.inProgress, icon: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></> },
        { label: "Needs your action", value: summary.needsAction, icon: <path d="M7 2h7l5 5v15H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM14 2v6h6M8 13h8M8 17h8" /> },
        { label: "Refunded", value: summary.refunded, icon: <path d="m4 12 5 5L20 6" /> },
    ];
    return <ul className="dl-claims-summary" aria-label="Claims summary">
        {metrics.map((metric) => <li key={metric.label} className="dl-card dl-metric">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{metric.icon}</svg>
            <div><span>{metric.label}</span><strong>{metric.value}</strong></div>
        </li>)}
    </ul>;
}
