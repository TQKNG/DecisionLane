import { PublicClientApplication } from "@azure/msal-browser";
export const AUTH_CONFIGURED=Boolean(process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID&&process.env.NEXT_PUBLIC_ENTRA_TENANT_ID&&process.env.NEXT_PUBLIC_API_SCOPE&&process.env.NEXT_PUBLIC_API_BASE_URL);
export const API_SCOPE=process.env.NEXT_PUBLIC_API_SCOPE||"";
export const LOGIN_REQUEST={scopes:["openid","profile","email",...(API_SCOPE?[API_SCOPE]:[])]};
export const MSAL_INSTANCE=new PublicClientApplication({auth:{clientId:process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID||"00000000-0000-0000-0000-000000000000",authority:`https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ENTRA_TENANT_ID||"common"}`,redirectUri:typeof window==="undefined"?undefined:window.location.origin},cache:{cacheLocation:"sessionStorage"}});
