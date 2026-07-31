import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthorizedTicketAdminRequest,
  hasValidTicketAdminSession,
  sanitizeAdminNextPath,
  unauthorizedAdminResponse,
} from "@/lib/ticket-admin-auth";

function isAdminLoginPath(pathname: string) {
  return pathname === "/tickets/admin/login" || pathname === "/api/tickets/admin/login";
}

function isAdminLogoutPath(pathname: string) {
  return pathname === "/api/tickets/admin/logout";
}

function isPublicIssuedTicketPath(pathname: string, searchParams: URLSearchParams) {
  return pathname === "/tickets/admin/issued" && searchParams.has("access");
}

export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (isAdminLoginPath(pathname) || isAdminLogoutPath(pathname)) {
    return NextResponse.next();
  }

  if (isPublicIssuedTicketPath(pathname, searchParams)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/tickets/admin/")) {
    if (await isAuthorizedTicketAdminRequest(request)) {
      return NextResponse.next();
    }

    return unauthorizedAdminResponse();
  }

  if (pathname.startsWith("/tickets/admin")) {
    if (await hasValidTicketAdminSession(request)) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/tickets/admin/login", request.url);
    loginUrl.searchParams.set("next", sanitizeAdminNextPath(`${pathname}${search}`));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/tickets/admin/:path*", "/api/tickets/admin/:path*"],
};
