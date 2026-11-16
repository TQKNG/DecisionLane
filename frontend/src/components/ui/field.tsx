import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldChromeProps {
    label: string;
    help?: string;
    error?: string;
}

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement>, FieldChromeProps {}

export interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChromeProps {}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement>, FieldChromeProps {
    placeholder?: string;
    options: readonly { value: string; label: string }[];
}

function useFieldIds(id: string | undefined, help?: string, error?: string) {
    const generatedId = React.useId();
    const controlId = id ?? generatedId;
    return { controlId, descriptionId: help || error ? `${controlId}-description` : undefined };
}

function FieldMessage({ id, help, error }: { id?: string; help?: string; error?: string }) {
    if (error) return <p id={id} className="dl-field-error">{error}</p>;
    if (help) return <p id={id} className="dl-field-help">{help}</p>;
    return null;
}

export function Field({ id, label, help, error, className, ...props }: FieldProps) {
    const { controlId, descriptionId } = useFieldIds(id, help, error);

    return <div className="dl-field">
        <label htmlFor={controlId}>{label}</label>
        <input id={controlId} className={cn("dl-field-control", className)} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props} />
        <FieldMessage id={descriptionId} help={help} error={error} />
    </div>;
}

export function TextareaField({ id, label, help, error, className, ...props }: TextareaFieldProps) {
    const { controlId, descriptionId } = useFieldIds(id, help, error);

    return <div className="dl-field">
        <label htmlFor={controlId}>{label}</label>
        <textarea id={controlId} className={cn("dl-field-control", className)} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props} />
        <FieldMessage id={descriptionId} help={help} error={error} />
    </div>;
}

export function SelectField({ id, label, help, error, className, placeholder, options, ...props }: SelectFieldProps) {
    const { controlId, descriptionId } = useFieldIds(id, help, error);

    return <div className="dl-field">
        <label htmlFor={controlId}>{label}</label>
        <select id={controlId} className={cn("dl-field-control", className)} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props}>
            {placeholder && <option value="" disabled>{placeholder}</option>}
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <FieldMessage id={descriptionId} help={help} error={error} />
    </div>;
}
