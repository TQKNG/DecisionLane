import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border-[1.5px] px-5 py-2 text-sm font-semibold transition-[background-color,color,box-shadow,transform] hover:-translate-y-px hover:shadow-[var(--shadow-card)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:transform-none",
    {
        variants: {
            variant: {
                default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                outline: "border-primary bg-transparent text-foreground hover:bg-accent",
                ghost: "border-transparent text-foreground hover:bg-accent",
                accent: "border-brand bg-transparent text-brand-foreground hover:bg-accent",
                destructive: "border-destructive bg-transparent text-destructive hover:bg-destructive/10",
            },
            size: {
                default: "min-h-[42px]",
                sm: "min-h-[34px] px-3 py-1 text-[13px]",
                pill: "min-h-[42px] rounded-full",
            },
        },
        defaultVariants: { variant: "default", size: "default" },
    },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
