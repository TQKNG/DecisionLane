"use client";

import { MsalProvider } from "@azure/msal-react";
import { useEffect, useState } from "react";

import { MSAL_INSTANCE } from "@/lib/auth";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    MSAL_INSTANCE.initialize().then(() => setReady(true));
  }, []);

  if (!ready) return <main className="p-8">Loading sign-in...</main>;
  return <MsalProvider instance={MSAL_INSTANCE}>{children}</MsalProvider>;
}