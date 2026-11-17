"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./file-picker.module.css";

export interface FilePickerProps {
    id?: string;
    label: string;
    description: string;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    error?: string;
    onFiles: (files: File[]) => void;
}

/** File input with a drop zone. The native input stays focusable, so keyboard and screen reader users get the standard file dialog. */
export function FilePicker({ id, label, description, accept, multiple = false, disabled = false, error, onFiles }: FilePickerProps) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;
    const [dragging, setDragging] = React.useState(false);

    function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
        event.preventDefault();
        setDragging(false);
        if (!disabled && event.dataTransfer.files.length) onFiles(Array.from(event.dataTransfer.files));
    }

    return <div className={styles.root}>
        <input
            id={inputId}
            className={styles.input}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
                if (event.target.files?.length) onFiles(Array.from(event.target.files));
                event.target.value = "";
            }}
        />
        <label
            htmlFor={inputId}
            className={cn(styles.zone, dragging && styles.dragging, error && styles.invalid)}
            data-disabled={disabled || undefined}
            onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
        >
            <svg className={styles.icon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
            <span className={styles.title}>{label}</span>
            <span id={descriptionId} className={styles.description}>{description}</span>
            <span className={styles.browse} aria-hidden="true">Choose files</span>
        </label>
        {error && <p id={errorId} className="dl-field-error">{error}</p>}
    </div>;
}
