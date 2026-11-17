import { apiError, ApiAuthRequiredError, type ApiError, type ApiServices } from "@/lib/api/base-query";

const REVIEW_DOCUMENT_PATH = /^\/v1\/reviews\/[^/]+\/documents\/[^/]+$/;

/**
 * Downloads review evidence through the API with the reviewer's bearer token.
 * Only API-relative review document paths are accepted, so the token is never sent to another host.
 */
export async function downloadEvidence(services: ApiServices, downloadPath: string): Promise<Blob> {
    if (!services.baseUrl) throw apiError("not_configured");
    if (!REVIEW_DOCUMENT_PATH.test(downloadPath)) throw apiError("validation", "This evidence link is not valid.");

    let accessToken: string;
    try {
        accessToken = await services.getAccessToken();
    } catch (cause) {
        throw cause instanceof ApiAuthRequiredError ? apiError("unauthorized") : apiError("network", "We could not confirm your sign-in. Please try again.");
    }

    let response: Response;
    try {
        response = await (services.fetchFn ?? fetch)(`${services.baseUrl}${downloadPath}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch {
        throw apiError("network");
    }
    if (!response.ok) throw downloadError(response.status);
    return response.blob();
}

function downloadError(status: number): ApiError {
    if (status === 401) return { ...apiError("unauthorized"), status };
    if (status === 403) return { ...apiError("forbidden"), status };
    if (status === 404) return { ...apiError("not_found", "This evidence file is no longer available."), status };
    return { ...apiError("server", "We could not download this evidence. Please try again."), status };
}
