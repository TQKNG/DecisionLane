import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

export type ApiErrorKind = "not_configured" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "validation" | "network" | "server";

export interface ApiError {
    kind: ApiErrorKind;
    status?: number;
    detail: string;
}

export interface ApiServices {
    baseUrl: string;
    getAccessToken: () => Promise<string>;
    fetchFn?: typeof fetch;
}

/** Thrown by an access token provider when the user must sign in again. */
export class ApiAuthRequiredError extends Error {
    constructor() {
        super("Your session has expired. Please sign in again.");
        this.name = "ApiAuthRequiredError";
    }
}

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_DETAILS: Record<ApiErrorKind, string> = {
    not_configured: "The DecisionLane API is not configured for this workspace.",
    unauthorized: "Your session has expired. Please sign in again.",
    forbidden: "Your account does not have access to this action.",
    not_found: "We could not find what you were looking for.",
    conflict: "This request conflicts with the current state. Refresh and try again.",
    validation: "Some details are not valid. Check them and try again.",
    network: "We could not reach DecisionLane. Check your connection and try again.",
    server: "DecisionLane could not complete the request. Please try again.",
};

function kindForStatus(status: number): ApiErrorKind {
    if (status === 401) return "unauthorized";
    if (status === 403) return "forbidden";
    if (status === 404) return "not_found";
    if (status === 409) return "conflict";
    if (status === 400 || status === 422) return "validation";
    return "server";
}

function detailFrom(data: unknown): string | undefined {
    if (!data || typeof data !== "object" || !("detail" in data)) return undefined;
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const messages = detail.map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : "")).filter(Boolean);
        if (messages.length) return messages.join(" ");
    }
    return undefined;
}

export function toApiError(error: FetchBaseQueryError): ApiError {
    if (typeof error.status === "number") {
        const kind = kindForStatus(error.status);
        return { kind, status: error.status, detail: detailFrom(error.data) ?? DEFAULT_DETAILS[kind] };
    }
    if (error.status === "PARSING_ERROR") {
        const kind = kindForStatus(error.originalStatus);
        return { kind, status: error.originalStatus, detail: DEFAULT_DETAILS[kind] };
    }
    return { kind: "network", detail: DEFAULT_DETAILS.network };
}

export function apiError(kind: ApiErrorKind, detail?: string): ApiError {
    return { kind, detail: detail ?? DEFAULT_DETAILS[kind] };
}

export function isApiError(value: unknown): value is ApiError {
    return Boolean(value && typeof value === "object" && "kind" in value && "detail" in value);
}

/**
 * Sends authenticated requests to the DecisionLane API.
 * The base URL and token provider come from the store's thunk extra argument so tests can inject them.
 */
export const apiBaseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, api, extraOptions) => {
    const services = api.extra as ApiServices | undefined;
    if (!services?.baseUrl) return { error: apiError("not_configured") };

    let accessToken: string;
    try {
        accessToken = await services.getAccessToken();
    } catch (cause) {
        return { error: cause instanceof ApiAuthRequiredError ? apiError("unauthorized") : apiError("network", "We could not confirm your sign-in. Please try again.") };
    }

    const rawBaseQuery = fetchBaseQuery({
        baseUrl: services.baseUrl,
        fetchFn: services.fetchFn,
        timeout: REQUEST_TIMEOUT_MS,
        prepareHeaders: (headers) => {
            headers.set("Authorization", `Bearer ${accessToken}`);
            return headers;
        },
    });
    const result = await rawBaseQuery(args, api, extraOptions);
    if (result.error) return { error: toApiError(result.error), meta: result.meta };
    return { data: result.data, meta: result.meta };
};
