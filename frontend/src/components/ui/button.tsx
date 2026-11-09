import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const BUTTON_VARIANTS = cva("button", { variants: { variant: { default: "", secondary: "secondary", destructive: "danger", outline: "secondary" } }, defaultVariants: { variant: "default" } });
export function Button({ className, variant, asChild = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof BUTTON_VARIANTS> & {
    asChild?: boolean;
}) { const Component = asChild ? Slot : "button"; return <Component className={cn(BUTTON_VARIANTS({ variant }), className)} {...props}/>; }
