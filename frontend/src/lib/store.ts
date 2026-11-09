import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Claim, ClaimDraft, Kpis, ReviewDetail } from "./types";
import { transport, type TransportSession } from "./data/transport";
type QueryArg = TransportSession & {
    path: string;
};
export const refundApi = createApi({ reducerPath: "refundApi", baseQuery: fakeBaseQuery<{
        message: string;
    }>(), tagTypes: ["Claims"], endpoints: builder => ({
        claims: builder.query<Claim[], QueryArg>({ queryFn: async (arg) => { try {
                return { data: await transport(arg, arg.path) as Claim[] };
            }
            catch (error) {
                return { error: { message: String(error) } };
            } }, providesTags: ["Claims"] }),
        claim: builder.query<Claim, QueryArg>({ queryFn: async (arg) => { try {
                return { data: await transport(arg, arg.path) as Claim };
            }
            catch (error) {
                return { error: { message: String(error) } };
            } }, providesTags: ["Claims"] }),
        review: builder.query<ReviewDetail, QueryArg>({ queryFn: async (arg) => { try {
                return { data: await transport(arg, arg.path) as ReviewDetail };
            }
            catch (error) {
                return { error: { message: String(error) } };
            } }, providesTags: ["Claims"] }),
        kpis: builder.query<Kpis, QueryArg>({ queryFn: async (arg) => { try {
                return { data: await transport(arg, arg.path) as Kpis };
            }
            catch (error) {
                return { error: { message: String(error) } };
            } }, providesTags: ["Claims"] }),
        action: builder.mutation<unknown, QueryArg & {
            init: RequestInit;
        }>({ queryFn: async (arg) => { try {
                return { data: await transport(arg, arg.path, arg.init) };
            }
            catch (error) {
                return { error: { message: String(error) } };
            } }, invalidatesTags: ["Claims"] })
    }) });
const DRAFT_SLICE = createSlice({ name: "drafts", initialState: {} as Record<string, ClaimDraft>, reducers: { saveDraft: (state, action: PayloadAction<{
            accountKey: string;
            draft: ClaimDraft;
        }>) => { state[action.payload.accountKey] = action.payload.draft; }, clearDraft: (state, action: PayloadAction<string>) => { delete state[action.payload]; } } });
export const { saveDraft, clearDraft } = DRAFT_SLICE.actions;
export function makeStore() { return configureStore({ reducer: { [refundApi.reducerPath]: refundApi.reducer, drafts: DRAFT_SLICE.reducer }, middleware: getDefault => getDefault().concat(refundApi.middleware) }); }
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export const { useClaimsQuery, useClaimQuery, useReviewQuery, useKpisQuery, useActionMutation } = refundApi;
