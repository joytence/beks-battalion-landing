import { NextResponse } from "next/server";
import {
  isAuthorizedTicketAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/ticket-admin-auth";
import {
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  TicketingStoreError,
  transferPaidTicketOrder,
} from "@/lib/ticketing-store";

type TransferPayload = {
  actorLabel?: unknown;
  checkoutSessionId?: unknown;
  notes?: unknown;
  purchaserEmail?: unknown;
  purchaserName?: unknown;
  purchaserPhone?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    if (!isTicketAdminConfigured() || !isTicketingDatabaseConfigured()) {
      return NextResponse.json({ message: "Ticket Admin and the ticket database are required." }, { status: 500 });
    }

    if (!(await isAuthorizedTicketAdminRequest(request))) {
      return unauthorizedAdminResponse();
    }

    const payload = (await request.json().catch(() => ({}))) as TransferPayload;
    const purchaserEmail = clean(payload.purchaserEmail);

    if (purchaserEmail && !isValidEmail(purchaserEmail)) {
      return NextResponse.json({ message: "The new recipient email is invalid." }, { status: 400 });
    }

    const order = await transferPaidTicketOrder({
      actorLabel: clean(payload.actorLabel) || "Ticket Admin",
      checkoutSessionId: clean(payload.checkoutSessionId),
      notes: clean(payload.notes),
      purchaserEmail,
      purchaserName: clean(payload.purchaserName),
      purchaserPhone: clean(payload.purchaserPhone),
    });

    return NextResponse.json({
      message: "Paid ticket transferred. The Stripe payment and seat assignment were not changed.",
      purchaserEmail: order.purchaserEmail,
      purchaserName: order.purchaserName,
      purchaserPhone: order.purchaserPhone,
    });
  } catch (error) {
    const status = error instanceof TicketingStoreError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Paid ticket transfer failed.";
    return NextResponse.json({ message }, { status });
  }
}
