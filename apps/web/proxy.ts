import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createContentSecurityPolicy } from "./src/lib/csp";
import { audienceForRequestPath } from "./src/lib/audience-routing";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const audience = audienceForRequestPath(path, request.nextUrl.searchParams.get("audience"));
  const requestHeaders = new Headers(request.headers);
  const nonce = randomBytes(18).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
  requestHeaders.set("x-reviewroom-audience", audience);
  requestHeaders.set("x-reviewroom-request-path", path);
  const sessionSelector = request.nextUrl.searchParams.get("rr_session");
  if (sessionSelector !== null) requestHeaders.set("x-reviewroom-session-id", sessionSelector);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/reviewer/:path*", "/people/:path*", "/submissions/:path*", "/my-link/:path*", "/r/:path*", "/invite/:path*", "/reset-password", "/forms/:path*", "/team/:path*", "/settings/:path*"],
};
