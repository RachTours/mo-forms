"use client";

import { useCallback } from "react";
import { useWorkspaceSession } from "../components/workspace-shell";
import { requestApi, type RuntimeSchema } from "./api-client";

export function useApi() {
  const session = useWorkspaceSession();
  return useCallback(async function api<T>(path: string, init: RequestInit = {}, schema?: RuntimeSchema<T>): Promise<T> {
    return requestApi<T>(path, init, { role: session.role, csrfToken: session.csrfToken, sessionId: session.sessionId, ...(schema ? { schema } : {}) });
  }, [session.csrfToken, session.role, session.sessionId]);
}
