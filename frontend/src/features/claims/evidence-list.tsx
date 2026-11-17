import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/features/claims/claim-form-validation";
import type { UploadProgress, UploadStage } from "@/features/claims/claim-submission";
import type { EvidenceFile } from "@/features/claims/use-claim-submission";
import styles from "./new-claim.module.css";

const STAGES: Record<UploadStage, { label: string; variant: BadgeVariant }> = {
    waiting: { label: "Waiting", variant: "neutral" },
    uploading: { label: "Uploading", variant: "accent" },
    verifying: { label: "Verifying", variant: "accent" },
    verified: { label: "Verified", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
};

const TYPE_LABELS: Record<EvidenceFile["contentType"], string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
};

export function EvidenceList({ evidence, uploads, onRemove }: { evidence: readonly EvidenceFile[]; uploads: Record<string, UploadProgress>; onRemove?: (key: string) => void }) {
    if (!evidence.length) return null;
    return <ul className={styles.evidenceList} aria-label="Selected evidence files">
        {evidence.map((item) => {
            const progress = uploads[item.key];
            const stage = progress ? STAGES[progress.stage] : undefined;
            return <li key={item.key} className={styles.evidenceItem}>
                <svg className={styles.fileIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2h7l5 5v15H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM14 2v6h6" /></svg>
                <div className={styles.fileText}>
                    <span className={styles.fileName}>{item.file.name}</span>
                    <span className={styles.fileMeta}>{TYPE_LABELS[item.contentType]} · {formatFileSize(item.file.size)}</span>
                    {progress?.stage === "failed" && progress.error && <span className={styles.fileError}>{progress.error}</span>}
                </div>
                {stage && <Badge variant={stage.variant} aria-live="polite">{stage.label}</Badge>}
                {onRemove && <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.file.name}`}>Remove</Button>}
            </li>;
        })}
    </ul>;
}
