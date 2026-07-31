import { NextResponse } from "next/server";
import {
  getTicketAdminSessionCookieName,
  getTicketAdminSessionCookieOptions,
} from "@/lib/ticket-admin-auth";

function buildLogoutResponse(request: Request) {
  const loginUrl = new URL("/tickets/admin/login", request.url);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.set({
    name: getTicketAdminSessionCookieName(),
    value: "",
    ...getTicketAdminSessionCookieOptions(request.url),
    maxAge: 0,
  });

  return response;
}

export async function GET(request: Request) {
  return buildLogoutResponse(request);
}

export async function POST(request: Request) {
  return buildLogoutResponse(request);
}
