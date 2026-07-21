import { NextResponse } from "next/server";
import {
  findPaidTicketOrders,
  getAuthorizedAdminSecret,
  getTicketAdminSecret,
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  listRecentPaidTicketOrders,
  TicketingStoreError,
} from "@/lib/ticketing-store";

type RecoveryPayload = {
  limit?: unknown;
  query?: unknown;
  recent?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unauthorizedResponse() {
  return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    if (!isTicketAdminConfigured()) {
      return NextResponse.json(
        { message: "TICKET_ADMIN_SECRET is not configured yet." },
        { status: 500 },
      );
    }

    if (!isTicketingDatabaseConfigured()) {
      return NextResponse.json({ message: "DATABASE_URL is required first." }, { status: 500 });
    }

    if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
      return unauthorizedResponse();
    }

    const payload = (await request.json().catch(() => ({}))) as RecoveryPayload;
    const query = clean(payload.query);
    const recent = payload.recent === true;
    const requestedLimit =
      typeof payload.limit === "number" ? payload.limit : Number(clean(payload.limit));
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.round(requestedLimit), 12))
      : 8;

    if (!recent && !query) {
      return NextResponse.json(
        { message: "Enter a seat, order, checkout session, email, or phone number." },
        { status: 400 },
      );
    }

    const orders = recent
      ? await listRecentPaidTicketOrders(limit)
      : await findPaidTicketOrders(query, limit);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      message:
        orders.length < 1
          ? recent
            ? "No recent paid ticket orders were found."
            : "No paid ticket order matched that search."
          : recent
            ? `Loaded ${orders.length} recent paid ticket order${orders.length === 1 ? "" : "s"}.`
            : `Found ${orders.length} paid ticket order${orders.length === 1 ? "" : "s"}.`
      ,
      orders,
    });
  } catch (error) {
    console.error("Paid ticket recovery route error:", error);

    const status = error instanceof TicketingStoreError ? error.status : 500;
    const message =
      error instanceof Error && error.message
        ? error.message
        : "The paid ticket recovery lookup failed.";

    return NextResponse.json({ message }, { status });
  }
}
