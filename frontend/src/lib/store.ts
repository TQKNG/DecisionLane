import { configureStore } from "@reduxjs/toolkit";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

export const appApi = createApi({
    reducerPath: "appApi",
    baseQuery: fakeBaseQuery<{ message: string }>(),
    endpoints: () => ({}),
});

export function makeStore() {
    return configureStore({
        reducer: { [appApi.reducerPath]: appApi.reducer },
        middleware: (getDefault) => getDefault().concat(appApi.middleware),
    });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
