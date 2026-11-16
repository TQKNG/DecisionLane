import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query/react";
import { apiBaseQuery, type ApiServices } from "@/lib/api/base-query";

export const appApi = createApi({
    reducerPath: "appApi",
    baseQuery: apiBaseQuery,
    tagTypes: ["Claim"],
    endpoints: () => ({}),
});

export function makeStore(services: ApiServices) {
    return configureStore({
        reducer: { [appApi.reducerPath]: appApi.reducer },
        middleware: (getDefault) => getDefault({ thunk: { extraArgument: services } }).concat(appApi.middleware),
    });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
