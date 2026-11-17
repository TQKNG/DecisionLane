"use client";

import { useMsal } from "@azure/msal-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { isApiError, type ApiError, type ApiErrorKind } from "@/lib/api/base-query";
import { loginRequestFor } from "@/lib/auth";

const TITLES: Record<ApiErrorKind, string> = {
    not_configured: "DecisionLane is not connected",
    unauthorized: "Your session has expired",
    forbidden: "You do not have access",
    not_found: "Not found",
    conflict: "Something changed",
    validation: "Request not accepted",
    network: "We could not connect",
    server: "Something went wrong",
};

const DESCRIPTIONS: Partial<Record<ApiErrorKind, string>> = {
    not_configured: "The API address or scope is missing from this workspace's configuration. Contact your administrator.",
    unauthorized: "Sign in again to continue where you left off.",
    forbidden: "Your account is not set up for customer claims. Ask your administrator to assign the Customer role, or sign in with a different account.",
};

export interface ApiErrorStateProps {
    error: unknown;
    /** Overrides the title and description for specific error kinds on this screen. */
    messages?: Partial<Record<ApiErrorKind, { title: string; description: string }>>;
    onRetry?: () => void;
    retrying?: boolean;
    action?: React.ReactNode;
}

/** Explains a failed API request and offers the recovery action that fits it. */
export function ApiErrorState({ error, messages, onRetry, retrying = false, action }: ApiErrorStateProps) {
    const { instance } = useMsal();
    const [redirecting, setRedirecting] = useState(false);
    const [redirectError, setRedirectError] = useState(false);
    const apiError: ApiError = isApiError(error) ? error : { kind: "server", detail: "An unexpected error occurred." };
    const kind = apiError.kind;
    const title = messages?.[kind]?.title ?? TITLES[kind];
    const description = messages?.[kind]?.description ?? DESCRIPTIONS[kind] ?? apiError.detail;

    async function redirect(start: () => Promise<void>) {
        setRedirectError(false);
        setRedirecting(true);
        try {
            await start();
        } catch {
            setRedirectError(true);
            setRedirecting(false);
        }
    }

    let recovery: React.ReactNode = null;
    if (kind === "unauthorized") recovery = <Button disabled={redirecting} onClick={() => void redirect(() => instance.loginRedirect(loginRequestFor(window.location.pathname)))}>{redirecting ? "Opening sign-in..." : "Sign in again"}</Button>;
    else if (kind === "forbidden") recovery = <Button variant="outline" disabled={redirecting} onClick={() => void redirect(() => instance.logoutRedirect())}>{redirecting ? "Signing out..." : "Sign in with a different account"}</Button>;
    else if (kind !== "not_configured" && onRetry) recovery = <Button disabled={retrying} onClick={onRetry}>{retrying ? "Retrying..." : "Try again"}</Button>;

    return <EmptyState
        className="dl-error-state"
        title={title}
        description={description}
        action={<div className="dl-state-actions" role="group" aria-label="Recovery options">
            {redirectError && <Notice variant="destructive">We could not open Microsoft sign-in. Please try again.</Notice>}
            {recovery}
            {action}
        </div>}
    />;
}
