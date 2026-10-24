import { apiErrorSchema } from "@reviewroom/contracts";

type AudienceRole = "OWNER" | "ADMIN" | "REVIEWER";
export type RuntimeSchema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly retryable: boolean;

  constructor(input: { status: number; code: string; message: string; requestId?: string }) {
    super(input.message);
    this.name = "ApiClientError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.retryable = input.status === 0 || [408, 425, 429].includes(input.status) || input.status >= 500;
  }
}

export async function requestApi<T>(
  path: string,
  init: RequestInit = {},
  options: {
    role: AudienceRole;
    csrfToken: string;
    sessionId: string | null;
    fetcher?: typeof fetch;
    schema?: RuntimeSchema<T>;
  },
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    throw new TypeError("API requests require a same-origin relative API path.");
  }

  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("X-Reviewroom-Audience", options.role === "REVIEWER" ? "reviewer" : "admin");
  if (options.sessionId) headers.set("X-Reviewroom-Session-Id", options.sessionId);
  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", options.csrfToken);

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`/api/v1${path}`, {
      ...init,
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError({ status: 0, code: "NETWORK_ERROR", message: "The service could not be reached. Check your connection and try again." });
  }

  if (response.status === 204) return undefined as T;
  const requestIdHeader = response.headers.get("X-Request-Id") ?? undefined;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiClientError({
        status: response.status,
        code: "REQUEST_FAILED",
        message: response.status >= 500 ? "The service could not complete the request." : "The request could not be completed.",
        ...(requestIdHeader ? { requestId: requestIdHeader } : {}),
      });
    }
    throw new ApiClientError({ status: response.status, code: "INVALID_RESPONSE", message: "The service returned an unexpected response.", ...(requestIdHeader ? { requestId: requestIdHeader } : {}) });
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const detail = parsed.success ? parsed.data.error : undefined;
    const requestId = detail?.requestId ?? requestIdHeader;
    throw new ApiClientError({
      status: response.status,
      code: detail?.code ?? "REQUEST_FAILED",
      message: response.status >= 500 ? "The service could not complete the request." : detail?.message ?? "The request could not be completed.",
      ...(requestId ? { requestId } : {}),
    });
  }

  if (!options.schema) return body as T;
  const parsed = options.schema.safeParse(body);
  if (!parsed.success) throw new ApiClientError({ status: response.status, code: "INVALID_RESPONSE", message: "The service returned an unexpected response.", ...(requestIdHeader ? { requestId: requestIdHeader } : {}) });
  return parsed.data;
}
