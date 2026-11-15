import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Navigation({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
    return <nav className={cn("dl-nav", className)} aria-label="Main navigation" {...props}>{children}</nav>;
}

export function NavigationLink({ href, current = false, children, className }: { href: string; current?: boolean; children: React.ReactNode; className?: string }) {
    return <Link className={cn("dl-nav-link", className)} href={href} aria-current={current ? "page" : undefined}>{children}</Link>;
}
