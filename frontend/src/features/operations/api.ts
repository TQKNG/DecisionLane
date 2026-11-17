import { appApi } from "@/lib/store";
import type { AdminKpis, CreateOrderRequest, OrderRecord } from "@/features/operations/types";

export const operationsApi = appApi.injectEndpoints({
    endpoints: (build) => ({
        getAdminKpis: build.query<AdminKpis, void>({
            query: () => "/v1/admin/kpis",
            providesTags: ["AdminKpis"],
        }),
        createTestOrder: build.mutation<OrderRecord, CreateOrderRequest>({
            query: (body) => ({ url: "/v1/admin/orders", method: "POST", body }),
        }),
    }),
});

export const { useGetAdminKpisQuery, useCreateTestOrderMutation } = operationsApi;
