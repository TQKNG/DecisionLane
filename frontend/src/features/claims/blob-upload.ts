import type { UploadGrant } from "@/features/claims/types";

/** Error from a direct Blob upload. The message never contains the signed upload URL. */
export class BlobUploadError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = "BlobUploadError";
    }
}

/**
 * Uploads one evidence file to the grant's Blob URL with exactly the headers the API returned.
 * The request goes to Blob Storage, not the API, so it never carries the API bearer token.
 */
export async function uploadEvidenceToBlob(grant: UploadGrant, file: Blob, fetchFn: typeof fetch = fetch): Promise<void> {
    let response: Response;
    try {
        response = await fetchFn(grant.upload_url, { method: "PUT", headers: grant.required_headers, body: file });
    } catch {
        throw new BlobUploadError("The file could not be uploaded. Check your connection and try again.");
    }
    if (response.ok) return;
    if (response.status === 403) throw new BlobUploadError("The upload link has expired or was refused.", 403);
    throw new BlobUploadError("Storage did not accept the file. Please try again.", response.status);
}
