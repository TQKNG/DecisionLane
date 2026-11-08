"use client";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "react-redux";
import { AUTH_CONFIGURED, MSAL_INSTANCE } from "@/lib/auth";
import { makeStore } from "@/lib/store";
import { resetDemo } from "@/lib/data/demo";
import type { TransportSession } from "@/lib/data/transport";
import type { Role } from "@/lib/types";
interface Session extends TransportSession { authenticated:boolean; name:string; setDemo:(role:Role,reviewer?:string)=>void; exitDemo:()=>void; reset:()=>void; }
const SESSION=createContext<Session|null>(null);
export function useSession(){const session=useContext(SESSION);if(!session)throw new Error("Session provider missing");return session;}
function SessionProvider({children}:{children:React.ReactNode}) {
 const {accounts}=useMsal();
 const [demo,setDemoState]=useState<{role:Role;reviewer:string}|null>(null);
 const [store,setStore]=useState(makeStore);
 const account=accounts[0];const roles=(account?.idTokenClaims?.roles as string[]|undefined)||[];
 const role:Role=demo?.role||(roles.includes("Admin")?"Admin":roles.includes("Reviewer")?"Reviewer":"Customer");
 const accountKey=demo?`demo-${role.toLowerCase()}${role==="Reviewer"?`-${demo.reviewer}`:""}`:account?.homeAccountId||"anonymous";
 const session:Session={mode:demo?"demo":"live",role,accountKey,authenticated:Boolean(demo||account),name:demo?(role==="Customer"?"Alex Morgan":role==="Reviewer"?`Reviewer ${demo.reviewer}`:"Operations admin"):account?.name||"Guest",setDemo:(nextRole,reviewer="A")=>{setStore(makeStore());setDemoState({role:nextRole,reviewer});},exitDemo:()=>{setStore(makeStore());setDemoState(null);},reset:()=>{resetDemo();setStore(makeStore());}};
 return <SESSION.Provider value={session}><Provider key={accountKey} store={store}>{children}</Provider></SESSION.Provider>;
}
export function Providers({children}:{children:React.ReactNode}) {
 const [ready,setReady]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{MSAL_INSTANCE.initialize().then(()=>MSAL_INSTANCE.handleRedirectPromise()).then(()=>setReady(true)).catch(error=>setError(String(error)));},[]);
 const content=useMemo(()=>ready?<MsalProvider instance={MSAL_INSTANCE}><SessionProvider>{children}</SessionProvider></MsalProvider>:null,[ready,children]);
 if(error)return <main className="surface" role="alert">Sign-in initialization failed: {error}<button className="button" onClick={()=>location.reload()}>Retry</button></main>;
 if(!ready)return <main className="surface" role="status">Preparing your secure workspace...</main>;
 return <>{!AUTH_CONFIGURED&&<div className="config-note">Live service requires configuration. You can explore synthetic demo data from the sign-in screen.</div>}{content}</>;
}
