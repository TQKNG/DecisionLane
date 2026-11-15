"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const THEMES = ["light", "dark", "system"] as const;
type Theme = (typeof THEMES)[number];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

    const selectedTheme = mounted && THEMES.includes(theme as Theme) ? theme as Theme : "system";
    return <div className="theme-toggle" aria-label="Color theme" role="group">{THEMES.map((option) => <Button key={option} variant={selectedTheme === option ? "default" : "outline"} size="sm" aria-pressed={selectedTheme === option} onClick={() => setTheme(option)}>{option[0].toUpperCase() + option.slice(1)}</Button>)}</div>;
}
