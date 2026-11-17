import { cn } from "@/lib/utils";
import styles from "./progress-bar.module.css";

/** Labeled progress built on the native progress element, which exposes value and maximum to assistive technology. */
export function ProgressBar({ label, value, max, valueText, className }: { label: string; value: number; max: number; valueText?: string; className?: string }) {
    return <div className={cn(styles.root, className)}>
        <div className={styles.header}><span>{label}</span>{valueText && <span className={styles.value}>{valueText}</span>}</div>
        <progress className={styles.bar} value={value} max={max} aria-label={label} aria-valuetext={valueText} />
    </div>;
}
