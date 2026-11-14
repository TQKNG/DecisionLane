import * as React from "react";
import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "success" | "warning" | "destructive";

export function Notice({ className, variant = "info", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: NoticeVariant }) {
    return <div className={cn("dl-notice", className)} data-variant={variant} role={variant === "destructive" ? "alert" : "status"} {...props} />;
}
