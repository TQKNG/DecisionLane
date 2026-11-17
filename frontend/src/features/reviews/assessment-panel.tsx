import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatAmount } from "@/features/claims/format";
import { formatPercent } from "@/features/reviews/decision";
import type { AssessmentResult, CriterionStatus, ReviewEvidenceDocument } from "@/features/reviews/types";
import styles from "./reviews.module.css";

const CRITERION_STATUS: Record<CriterionStatus, { label: string; variant: BadgeVariant }> = {
    pass: { label: "Met", variant: "success" },
    fail: { label: "Not met", variant: "destructive" },
    review: { label: "Check", variant: "warning" },
};

function criterionStatus(status: string) {
    return CRITERION_STATUS[status as CriterionStatus] ?? { label: status, variant: "neutral" as const };
}

export function AssessmentPanel({ assessment, currency, documents }: { assessment: AssessmentResult; currency: string; documents: readonly ReviewEvidenceDocument[] }) {
    const fileNames = new Map(documents.map((item) => [item.document.id, item.document.file_name]));
    return <Card className={styles.section} aria-labelledby="assessment-title">
        <div className={styles.sectionHead}>
            <h2 id="assessment-title">AI assessment</h2>
            <Badge variant={assessment.eligible ? "success" : "destructive"}>{assessment.eligible ? "Eligible" : "Not eligible"}</Badge>
        </div>
        <dl className={styles.facts}>
            <div><dt>Proposed refund</dt><dd>{formatAmount(assessment.proposed_refund_amount, currency)}</dd></div>
            <div><dt>Confidence</dt><dd>{formatPercent(assessment.confidence)}</dd></div>
            <div><dt>Reviewers needed</dt><dd>{assessment.requires_two_reviewers ? "Two" : "One"}</dd></div>
        </dl>
        <p className={styles.summary}>{assessment.summary}</p>
        {assessment.criteria.length > 0 && <ol className={styles.criteria} aria-label="Assessment criteria">
            {assessment.criteria.map((criterion, index) => {
                const status = criterionStatus(criterion.status);
                const evidence = criterion.evidence_document_ids.map((id) => fileNames.get(id) ?? id);
                return <li key={`${criterion.name}-${index}`} className={styles.criterion}>
                    <div className={styles.criterionHead}><h3>{criterion.name}</h3><Badge variant={status.variant}>{status.label}</Badge></div>
                    <p>{criterion.explanation}</p>
                    {evidence.length > 0 && <p className={styles.muted}>Evidence: {evidence.join(", ")}</p>}
                    {criterion.citations.map((citation) => <figure key={`${citation.policy_id}-${citation.chunk_id}`} className={styles.citation}>
                        <blockquote>{citation.quote}</blockquote>
                        <figcaption>{citation.title}, policy {citation.policy_id} version {citation.policy_version}</figcaption>
                    </figure>)}
                </li>;
            })}
        </ol>}
        <p className={styles.provenance}>Model {assessment.model_deployment}, prompt {assessment.prompt_version}, policy snapshot {assessment.policy_snapshot_id}.</p>
    </Card>;
}
