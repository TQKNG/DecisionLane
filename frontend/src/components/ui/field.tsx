import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    help?: string;
    error?: string;
}

export function Field({ id, label, help, error, className, ...props }: FieldProps) {
    const generatedId = React.useId();
    const controlId = id ?? generatedId;
    const descriptionId = help || error ? `${controlId}-description` : undefined;

    return <div className="dl-field">
        <label htmlFor={controlId}>{label}</label>
        <input id={controlId} className={cn("dl-field-control", className)} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props} />
        {error ? <p id={descriptionId} className="dl-field-error">{error}</p> : help ? <p id={descriptionId} className="dl-field-help">{help}</p> : null}
    </div>;
}
