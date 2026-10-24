import type { SessionResponse } from "@reviewroom/contracts";

type SignOutSession = Pick<SessionResponse, "role" | "csrfToken" | "sessionId">;

export async function requestSignOut(session: SignOutSession, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = new Headers({
    "X-CSRF-Token": session.csrfToken,
    "X-Reviewroom-Audience": session.role === "REVIEWER" ? "reviewer" : "admin",
  });
  if (session.sessionId) headers.set("X-Reviewroom-Session-Id", session.sessionId);
  return fetcher("/api/v1/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers,
  });
}

export async function signOutErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error?: unknown }).error;
      if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
    }
  } catch {
    // Use the plain-language fallback when the server response is empty or malformed.
  }
  return "Could not sign out. Check your connection and try again.";
}
