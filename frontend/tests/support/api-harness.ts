import { vi } from "vitest";
import type { ApiServices } from "@/lib/api/base-query";
import { makeStore } from "@/lib/store";

export const TEST_BASE_URL = "https://api.example.test";
export const TEST_TOKEN = "synthetic-test-token";

export interface RecordedRequest {
    method: string;
    url: string;
    headers: Headers;
    body: string;
}

export function jsonResponse(status: number, body: unknown): Response {
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Builds a store whose API calls go to a scripted fetch and a synthetic token provider. */
export function createApiHarness(responder: (request: RecordedRequest) => Response | Promise<Response>, overrides: Partial<ApiServices> = {}) {
    const requests: RecordedRequest[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        const recorded = { method: request.method, url: request.url, headers: request.headers, body: await request.clone().text() };
        requests.push(recorded);
        return responder(recorded);
    });
    const store = makeStore({ baseUrl: TEST_BASE_URL, getAccessToken: async () => TEST_TOKEN, fetchFn: fetchFn as typeof fetch, ...overrides });
    return { store, requests, fetchFn };
}
