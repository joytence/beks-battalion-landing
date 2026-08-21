import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthorizedTicketAdminRequest,
  hasValidTicketAdminSession,
  sanitizeAdminNextPath,
  unauthorizedAdminResponse,
} from "@/lib/ticket-admin-auth";

const INTERNAL_TRAFFIC_COOKIE_NAME = "jsp_internal";
const INTERNAL_TRAFFIC_COOKIE_DURATION_SECONDS = 60 * 60 * 24 * 365;

function isAdminLoginPath(pathname: string) {
  return pathname === "/tickets/admin/login" || pathname === "/api/tickets/admin/login";
}

function isAdminLogoutPath(pathname: string) {
  return pathname === "/api/tickets/admin/logout";
}

function isPublicIssuedTicketPath(pathname: string, searchParams: URLSearchParams) {
  return pathname === "/tickets/admin/issued" && searchParams.has("access");
}

function applyInternalTrafficCookie(request: NextRequest, response: NextResponse) {
  if (request.nextUrl.searchParams.get("internal") !== "1") {
    return response;
  }

  response.cookies.set(INTERNAL_TRAFFIC_COOKIE_NAME, "true", {
    httpOnly: false,
    maxAge: INTERNAL_TRAFFIC_COOKIE_DURATION_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (isAdminLoginPath(pathname) || isAdminLogoutPath(pathname)) {
    return applyInternalTrafficCookie(request, NextResponse.next());
  }

  if (isPublicIssuedTicketPath(pathname, searchParams)) {
    return applyInternalTrafficCookie(request, NextResponse.next());
  }

  if (pathname.startsWith("/api/tickets/admin/")) {
    if (await isAuthorizedTicketAdminRequest(request)) {
      return applyInternalTrafficCookie(request, NextResponse.next());
    }

    return applyInternalTrafficCookie(request, unauthorizedAdminResponse());
  }

  if (pathname.startsWith("/tickets/admin")) {
    if (await hasValidTicketAdminSession(request)) {
      return applyInternalTrafficCookie(request, NextResponse.next());
    }

    const loginUrl = new URL("/tickets/admin/login", request.url);
    loginUrl.searchParams.set("next", sanitizeAdminNextPath(`${pathname}${search}`));
    return applyInternalTrafficCookie(request, NextResponse.redirect(loginUrl));
  }

  return applyInternalTrafficCookie(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
