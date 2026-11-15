import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, className }: { title: string; description: string; action?: React.ReactNode; className?: string }) {
    return <section className={cn("dl-card dl-state", className)}>
        <h2>{title}</h2>
        <p>{description}</p>
        {action}
    </section>;
}

export function LoadingState({ message = "Loading...", className }: { message?: string; className?: string }) {
    return <div className={cn("dl-state", className)} role="status" aria-live="polite">
        <span className="dl-spinner" aria-hidden="true" />
        <p>{message}</p>
    </div>;
}
