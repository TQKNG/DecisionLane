import { appApi } from "@/lib/store";
import type { ClaimSubmissionResponse, CreateClaimRequest, ListClaimsArgs, RefundClaim, UploadCompleteResponse, UploadGrant, UploadRequest } from "@/features/claims/types";

const claimPath = (claimId: string) => `/v1/claims/${encodeURIComponent(claimId)}`;

export const claimsApi = appApi.injectEndpoints({
    endpoints: (build) => ({
        listClaims: build.query<RefundClaim[], ListClaimsArgs | void>({
            query: (args) => ({ url: "/v1/claims", params: args?.status ? { status: args.status } : undefined }),
            providesTags: (result) => [...(result ?? []).map((claim) => ({ type: "Claim" as const, id: claim.id })), { type: "Claim" as const, id: "LIST" }],
        }),
        createClaim: build.mutation<RefundClaim, CreateClaimRequest>({
            query: (body) => ({ url: "/v1/claims", method: "POST", body }),
            invalidatesTags: [{ type: "Claim", id: "LIST" }],
        }),
        requestUpload: build.mutation<UploadGrant, { claimId: string; upload: UploadRequest }>({
            query: ({ claimId, upload }) => ({ url: `${claimPath(claimId)}/uploads`, method: "POST", body: upload }),
        }),
        completeUpload: build.mutation<UploadCompleteResponse, { claimId: string; documentId: string }>({
            query: ({ claimId, documentId }) => ({ url: `${claimPath(claimId)}/uploads/${encodeURIComponent(documentId)}/complete`, method: "POST" }),
        }),
        submitClaim: build.mutation<ClaimSubmissionResponse, { claimId: string }>({
            query: ({ claimId }) => ({ url: `${claimPath(claimId)}/submit`, method: "POST" }),
            invalidatesTags: (_result, _error, { claimId }) => [{ type: "Claim", id: claimId }, { type: "Claim", id: "LIST" }],
        }),
    }),
});

export const { useListClaimsQuery } = claimsApi;
