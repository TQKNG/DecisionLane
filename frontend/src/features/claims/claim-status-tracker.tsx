import { cn } from "@/lib/utils";
import { CLAIM_PROGRESS_STEPS, claimStatusStep } from "@/features/claims/status";
import styles from "./claim-detail.module.css";

const TONE_LABELS = { active: "In progress", attention: "Needs attention", complete: "Complete", stopped: "Stopped" } as const;

/** Shows how far a claim has progressed. Each step states its state in text, so it never relies on color alone. */
export function ClaimStatusTracker({ status }: { status: string }) {
    const step = claimStatusStep(status);
    return <ol className={styles.tracker} aria-label="Claim progress">
        {CLAIM_PROGRESS_STEPS.map((label, index) => {
            const done = index < step.current || (index === step.current && step.tone === "complete");
            const current = index === step.current && !done;
            const state = done ? "Complete" : current ? TONE_LABELS[step.tone] : "Not started";
            return <li key={label} className={cn(styles.trackerStep, done && styles.done, current && styles.current, current && styles[step.tone])} aria-current={current ? "step" : undefined}>
                <span className={styles.trackerMarker} aria-hidden="true">{done ? "✓" : index + 1}</span>
                <span className={styles.trackerLabel}>{label}</span>
                <span className={styles.trackerState}>{state}</span>
            </li>;
        })}
    </ol>;
}
