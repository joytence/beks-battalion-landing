import { NextResponse } from "next/server";
import {
  createTicketAdminSessionToken,
  getTicketAdminSessionCookieName,
  getTicketAdminSessionCookieOptions,
  isTicketAdminConfigured,
  sanitizeAdminNextPath,
} from "@/lib/ticket-admin-auth";
import { normalizeAdminSecretValue } from "@/lib/ticketing-store";

type LoginPayload = {
  next?: unknown;
  password?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getClientLabel(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";

  return { ip, userAgent };
}

export async function POST(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as LoginPayload;
  const password = normalizeAdminSecretValue(clean(payload.password));
  const expectedPassword = normalizeAdminSecretValue(process.env.TICKET_ADMIN_SECRET || "");
  const redirectTo = sanitizeAdminNextPath(clean(payload.next) || "/tickets/admin");
  const client = getClientLabel(request);

  if (!password || password !== expectedPassword) {
    console.warn("Ticket admin login failed.", {
      at: new Date().toISOString(),
      ip: client.ip,
      userAgent: client.userAgent,
    });

    return NextResponse.json({ message: "Admin login failed." }, { status: 401 });
  }

  const response = NextResponse.json({
    message: "Admin session created.",
    redirectTo,
  });
  const sessionToken = await createTicketAdminSessionToken();

  response.cookies.set({
    name: getTicketAdminSessionCookieName(),
    value: sessionToken,
    ...getTicketAdminSessionCookieOptions(request.url),
  });

  console.info("Ticket admin login succeeded.", {
    at: new Date().toISOString(),
    ip: client.ip,
    userAgent: client.userAgent,
  });

  return response;
}
