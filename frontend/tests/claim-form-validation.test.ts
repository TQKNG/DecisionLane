import { describe, expect, it } from "vitest";
import { BlobUploadError, uploadEvidenceToBlob } from "@/features/claims/blob-upload";
import { checkEvidenceFile, detectEvidenceContentType, MAX_EVIDENCE_BYTES, validateClaimForm, type ClaimFormValues } from "@/features/claims/claim-form-validation";

const VALID: ClaimFormValues = { orderId: "order-test-001", claimType: "damaged_item", requestedAmount: "42.50", reason: "The parcel arrived crushed." };
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

function namedBlob(bytes: number[] | Uint8Array, name: string, type = "") {
    return Object.assign(new Blob([new Uint8Array(bytes)], { type }), { name });
}

describe("validateClaimForm", () => {
    it("accepts a complete claim", () => {
        expect(validateClaimForm(VALID, 1)).toEqual({});
    });

    it("reports every missing field", () => {
        expect(Object.keys(validateClaimForm({ orderId: " ", claimType: "", requestedAmount: "", reason: "short" }, 0)).sort()).toEqual(["claimType", "evidence", "orderId", "reason", "requestedAmount"]);
    });

    it.each(["0", "-1", "1.234", "abc", "1e3"])("rejects the amount %s", (requestedAmount) => {
        expect(validateClaimForm({ ...VALID, requestedAmount }, 1).requestedAmount).toBeTruthy();
    });

    it("limits the number of files", () => {
        expect(validateClaimForm(VALID, 6).evidence).toBeTruthy();
    });
});

describe("evidence files", () => {
    it.each([
        [[0x25, 0x50, 0x44, 0x46, 0x2d], "application/pdf"],
        [[0xff, 0xd8, 0xff, 0xe0], "image/jpeg"],
        [PNG_HEADER, "image/png"],
        [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image/webp"],
        [[0x50, 0x4b, 0x03, 0x04], undefined],
    ])("detects %j as %s", (bytes, expected) => {
        expect(detectEvidenceContentType(new Uint8Array(bytes))).toBe(expected);
    });

    it("uses the file signature rather than the declared type", async () => {
        expect(await checkEvidenceFile(namedBlob(PNG_HEADER, "photo.pdf", "application/pdf"))).toEqual({ ok: true, contentType: "image/png" });
    });

    it("rejects empty, oversized, and unsupported files", async () => {
        expect(await checkEvidenceFile(namedBlob([], "empty.png"))).toMatchObject({ ok: false });
        expect(await checkEvidenceFile(namedBlob(new Uint8Array(MAX_EVIDENCE_BYTES + 1), "large.png"))).toMatchObject({ ok: false, error: "The file is larger than 4 MB." });
        expect(await checkEvidenceFile(namedBlob([0x50, 0x4b, 0x03, 0x04], "notes.docx"))).toMatchObject({ ok: false });
    });
});

describe("uploadEvidenceToBlob", () => {
    const grant = { document_id: "d", blob_name: "b", upload_url: "https://storage.example.test/quarantine/d.png", required_headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "image/png" } };

    it("PUTs the file with only the grant headers", async () => {
        let captured: Request | undefined;
        const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
            captured = new Request(input, init);
            return new Response(null, { status: 201 });
        }) as typeof fetch;
        await uploadEvidenceToBlob(grant, new Blob([new Uint8Array(PNG_HEADER)]), fetchFn);

        expect(captured?.method).toBe("PUT");
        expect(captured?.url).toBe(grant.upload_url);
        expect(captured?.headers.get("x-ms-blob-type")).toBe("BlockBlob");
        expect(captured?.headers.get("content-type")).toBe("image/png");
        expect(captured?.headers.get("authorization")).toBeNull();
    });

    it("reports failures without exposing the signed URL", async () => {
        const refused = (async () => new Response(null, { status: 403 })) as typeof fetch;
        const offline = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;

        for (const fetchFn of [refused, offline]) {
            const error = await uploadEvidenceToBlob(grant, new Blob(["x"]), fetchFn).catch((cause: unknown) => cause);
            expect(error).toBeInstanceOf(BlobUploadError);
            expect((error as Error).message).not.toContain("storage.example.test");
        }
    });
});
