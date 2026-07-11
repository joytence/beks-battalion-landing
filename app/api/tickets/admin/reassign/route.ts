import { NextResponse } from "next/server";
import {
  getTicketAdminSecret,
  isTicketAdminConfigured,
  reassignReservedSeatTicket,
  TicketingStoreError,
} from "@/lib/ticketing-store";

type ReassignPayload = {
  actorLabel?: unknown;
  checkoutSessionId?: unknown;
  newSeatLabel?: unknown;
  notes?: unknown;
  ticketIndex?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAuthorizedSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-ticket-admin-secret")?.trim() || "";
}

export async function POST(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (getAuthorizedSecret(request) !== getTicketAdminSecret()) {
    return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
  }

  const payload = (await request.json()) as ReassignPayload;
  const ticketIndex =
    typeof payload.ticketIndex === "number" ? payload.ticketIndex : Number(payload.ticketIndex);

  try {
    const reassignment = await reassignReservedSeatTicket({
      actorLabel: clean(payload.actorLabel) || "Admin Override",
      checkoutSessionId: clean(payload.checkoutSessionId),
      newSeatLabel: clean(payload.newSeatLabel),
      notes: clean(payload.notes),
      ticketIndex,
    });

    return NextResponse.json(reassignment);
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Seat reassignment failed." },
      { status: 500 },
    );
  }
}
