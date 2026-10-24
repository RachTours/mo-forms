import { cookies, headers as requestHeaders } from "next/headers";
import { resolveServerApiOrigin } from "./server-api-origin";

const apiOrigin = resolveServerApiOrigin(process.env.API_INTERNAL_URL, process.env.NODE_ENV);

export async function serverApi(path: string, init: RequestInit = {}): Promise<Response> {
  const [cookieStore, incomingHeaders] = await Promise.all([cookies(), requestHeaders()]);
  const headers = new Headers(init.headers);
  headers.set("cookie", cookieStore.toString());
  const audience = incomingHeaders.get("x-reviewroom-audience");
  headers.set("x-reviewroom-audience", audience === "reviewer" ? "reviewer" : "admin");
  const sessionId = incomingHeaders.get("x-reviewroom-session-id");
  if (sessionId) headers.set("x-reviewroom-session-id", sessionId);
  return fetch(`${apiOrigin}/api/v1${path}`, { ...init, headers, cache: "no-store" });
}

export async function publicApi(path: string): Promise<Response> {
  return fetch(`${apiOrigin}/api/v1${path}`, { cache: "no-store" });
}

export async function readData<T>(response: Response, parse: (value: unknown) => T): Promise<T> {
  if (!response.ok) throw new Error(`The service returned ${response.status}.`);
  const body: unknown = await response.json();
  return parse(body);
}
