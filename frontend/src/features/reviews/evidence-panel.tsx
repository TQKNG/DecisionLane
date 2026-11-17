"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { formatFileSize } from "@/features/claims/claim-form-validation";
import { formatPercent } from "@/features/reviews/decision";
import { downloadEvidence } from "@/features/reviews/evidence-download";
import type { ReviewEvidenceDocument } from "@/features/reviews/types";
import { isApiError } from "@/lib/api/base-query";
import { acquireApiToken, API_BASE_URL, API_CONFIGURED } from "@/lib/auth";
import styles from "./reviews.module.css";

const EVIDENCE_SERVICES = { baseUrl: API_CONFIGURED ? API_BASE_URL : "", getAccessToken: acquireApiToken };
// Object URLs share the app's origin, so only these accepted evidence types are ever rendered, and the type is set here, not by the response.
const PREVIEW_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function formatLabel(value: string | null | undefined): string {
    return value ? value.replace(/_/g, " ") : "Not classified";
}

interface LoadedEvidence {
    url: string;
    contentType: string;
}

function EvidenceItem({ item }: { item: ReviewEvidenceDocument }) {
    const { document, classification } = item;
    const [loaded, setLoaded] = useState<LoadedEvidence | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const urlRef = useRef<string | null>(null);

    useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

    async function load(): Promise<LoadedEvidence | null> {
        if (loaded) return loaded;
        setError("");
        setLoading(true);
        try {
            const blob = await downloadEvidence(EVIDENCE_SERVICES, item.download_path);
            const contentType = PREVIEW_TYPES.has(document.content_type) ? document.content_type : "application/octet-stream";
            const next = { url: URL.createObjectURL(new Blob([blob], { type: contentType })), contentType };
            urlRef.current = next.url;
            setLoaded(next);
            return next;
        } catch (cause) {
            setError(isApiError(cause) ? cause.detail : "We could not load this evidence. Please try again.");
            return null;
        } finally {
            setLoading(false);
        }
    }

    async function preview() {
        if (previewing) return setPreviewing(false);
        if (await load()) setPreviewing(true);
    }

    async function download() {
        const evidence = await load();
        if (!evidence) return;
        const link = window.document.createElement("a");
        link.href = evidence.url;
        link.download = document.file_name;
        link.click();
    }

    const canPreview = PREVIEW_TYPES.has(document.content_type);

    return <li className={styles.evidenceItem}>
        <div className={styles.evidenceHead}>
            <div>
                <p className={styles.fileName}>{document.file_name}</p>
                <p className={styles.muted}>{formatFileSize(document.size_bytes)}, {document.content_type}</p>
            </div>
            <div className={styles.evidenceActions}>
                {canPreview && <Button type="button" variant="outline" size="sm" disabled={loading} aria-expanded={previewing} onClick={() => void preview()}>{loading ? "Loading..." : previewing ? "Hide preview" : "Preview"}</Button>}
                <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void download()}>Download</Button>
            </div>
        </div>
        {classification ? <dl className={styles.classification}>
            <div><dt>Type</dt><dd><Badge variant="accent">{formatLabel(classification.evidence_type)}</Badge></dd></div>
            <div><dt>Confidence</dt><dd>{formatPercent(classification.confidence)}</dd></div>
            <div><dt>Image quality</dt><dd>{formatLabel(classification.image_quality)}</dd></div>
            {classification.damage_visible != null && <div><dt>Damage visible</dt><dd>{classification.damage_visible ? `Yes${classification.damage_type ? `, ${formatLabel(classification.damage_type)}` : ""}` : "No"}</dd></div>}
            <div className={styles.wide}><dt>Why</dt><dd>{classification.reason}</dd></div>
        </dl> : <p className={styles.muted}>This file has not been classified.</p>}
        {error && <Notice variant="destructive">{error}</Notice>}
        {previewing && loaded && (loaded.contentType.startsWith("image/")
            // eslint-disable-next-line @next/next/no-img-element -- object URLs cannot go through next/image.
            ? <img className={styles.preview} src={loaded.url} alt={`Evidence ${document.file_name}`} />
            : loaded.contentType === "application/pdf" && <object className={styles.preview} data={loaded.url} type="application/pdf" aria-label={`Evidence ${document.file_name}`}><p>This browser cannot show PDFs inline. Use Download instead.</p></object>)}
    </li>;
}

export function EvidencePanel({ documents }: { documents: readonly ReviewEvidenceDocument[] }) {
    return <Card className={styles.section} aria-labelledby="evidence-title">
        <h2 id="evidence-title">Evidence</h2>
        {documents.length ? <ul className={styles.evidenceList}>{documents.map((item) => <EvidenceItem key={item.document.id} item={item} />)}</ul> : <p className={styles.muted}>No evidence was submitted with this claim.</p>}
    </Card>;
}
