import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "destructive";

export function Badge({ className, variant = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
    return <span className={cn("dl-badge", className)} data-variant={variant} {...props} />;
}
