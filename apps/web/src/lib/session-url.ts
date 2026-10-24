export const sessionSelectorParam = "rr_session";

export function withSessionSelector(path: string, sessionId: string | null): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new TypeError("Session-aware routes must be same-origin paths.");
  if (!sessionId) return path;
  const url = new URL(path, "https://reviewroom.invalid");
  url.searchParams.set(sessionSelectorParam, sessionId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function sessionSelectorFromUrl(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  try {
    const selector = new URL(value, "https://reviewroom.invalid").searchParams.get(sessionSelectorParam);
    return selector && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selector) ? selector : undefined;
  } catch {
    return undefined;
  }
}
