import {PublicClientApplication} from "@azure/msal-browser"

const TENANT_ID = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID!;
const CLIENT_ID = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID!;

export const API_SCOPE = process.env.NEXT_PUBLIC_API_SCOPE!;
export const LOGIN_REQUEST ={scopes: ["openid", "profile", "email", API_SCOPE]}

export const MSAL_INSTANCE = new PublicClientApplication({
    auth:{
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: typeof window === "undefined" ? undefined : window.location.origin,
    },
    cache:{cacheLocation:"sessionStorage"}
})