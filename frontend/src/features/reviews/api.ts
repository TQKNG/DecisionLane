import { appApi } from "@/lib/store";
import type { ListClaimsArgs, RefundClaim } from "@/features/claims/types";
import type { ReviewDecisionRequest, ReviewDecisionResponse, ReviewDetail } from "@/features/reviews/types";

const reviewPath = (claimId: string) => `/v1/reviews/${encodeURIComponent(claimId)}`;

export const reviewsApi = appApi.injectEndpoints({
    endpoints: (build) => ({
        // Reviewers and Admins receive claims across customers from the same endpoint customers use.
        listReviewClaims: build.query<RefundClaim[], ListClaimsArgs | void>({
            query: (args) => ({ url: "/v1/claims", params: args?.status ? { status: args.status } : undefined }),
            providesTags: (result) => [...(result ?? []).map((claim) => ({ type: "Claim" as const, id: claim.id })), { type: "Claim" as const, id: "LIST" }],
        }),
        getReview: build.query<ReviewDetail, string>({
            query: (claimId) => reviewPath(claimId),
            providesTags: (_result, _error, claimId) => [{ type: "Review", id: claimId }, { type: "Claim", id: claimId }],
        }),
        decideReview: build.mutation<ReviewDecisionResponse, { claimId: string } & ReviewDecisionRequest>({
            query: ({ claimId, decision, comment }) => ({ url: `${reviewPath(claimId)}/decision`, method: "POST", body: { decision, comment } }),
            invalidatesTags: (_result, _error, { claimId }) => [{ type: "Review", id: claimId }, { type: "Claim", id: claimId }, { type: "Claim", id: "LIST" }, "AdminKpis"],
        }),
    }),
});

export const { useListReviewClaimsQuery, useGetReviewQuery, useDecideReviewMutation } = reviewsApi;
