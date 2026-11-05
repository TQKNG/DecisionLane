"use client";

import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";

import { API_SCOPE } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export function useApi() {
  const { instance, accounts } = useMsal();

  const request = useCallback(async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (accounts.length === 0) throw new Error("Sign in is required");
    const token = await instance.acquireTokenSilent({
      account: accounts[0],
      scopes: [API_SCOPE],
    });
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.accessToken}`,
        ...init.headers,
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${response.status}: ${detail}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }, [accounts, instance]);

  return { request };
}