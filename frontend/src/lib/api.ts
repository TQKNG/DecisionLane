"use client";
import { useCallback } from "react";
import { useSession } from "@/components/providers";
import { useActionMutation } from "@/lib/store";
export function useApi(){const {mode,role,accountKey}=useSession();const [action]=useActionMutation();const request=useCallback(async function request<T>(path:string,init:RequestInit={}):Promise<T>{return await action({mode,role,accountKey,path,init}).unwrap() as T;},[mode,role,accountKey,action]);return {request};}
