import { appApi } from "@/lib/store";
import type { ListClaimsArgs, RefundClaim } from "@/features/claims/types";

export const claimsApi = appApi.injectEndpoints({
    endpoints: (build) => ({
        listClaims: build.query<RefundClaim[], ListClaimsArgs | void>({
            query: (args) => ({ url: "/v1/claims", params: args?.status ? { status: args.status } : undefined }),
            providesTags: (result) => [...(result ?? []).map((claim) => ({ type: "Claim" as const, id: claim.id })), { type: "Claim" as const, id: "LIST" }],
        }),
    }),
});

export const { useListClaimsQuery } = claimsApi;
