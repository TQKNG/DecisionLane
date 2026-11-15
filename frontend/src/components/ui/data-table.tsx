import * as React from "react";
import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
    return <div className="dl-table-wrap" role="region" aria-label={props["aria-label"] ?? "Data table"} tabIndex={0}>
        <table className={cn("dl-table", className)} {...props} />
    </div>;
}
