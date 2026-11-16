import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClaimStatusBadge } from "@/features/claims/claim-status-badge";
import { presentClaimStatus } from "@/features/claims/status";
import styles from "./new-claim.module.css";

export function SubmissionResult({ claimId, status, onStartAnother }: { claimId: string; status: string; onStartAnother: () => void }) {
    const presentation = presentClaimStatus(status);
    return <Card className={styles.result} aria-labelledby="claim-submitted-title">
        <svg className={styles.resultIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m7.5 12.5 3 3 6-6.5" /></svg>
        <h2 id="claim-submitted-title" tabIndex={-1}>Claim submitted</h2>
        <p>Your claim <strong>{claimId}</strong> has been received.</p>
        <ClaimStatusBadge status={status} />
        <p className={styles.resultNext}>{presentation.description} You can follow its progress from your claims.</p>
        <div className={styles.resultActions}>
            <Button asChild size="pill"><Link href="/dashboard/">Back to your claims</Link></Button>
            <Button type="button" variant="outline" size="pill" onClick={onStartAnother}>Start another claim</Button>
        </div>
    </Card>;
}
