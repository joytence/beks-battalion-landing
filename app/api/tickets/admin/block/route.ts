import { NextResponse } from "next/server";
import {
  blockSeatsForAdmin,
  getAuthorizedAdminSecret,
  getTicketAdminSecret,
  isTicketAdminConfigured,
  TicketingStoreError,
  unblockSeatsForAdmin,
} from "@/lib/ticketing-store";

type BlockPayload = {
  actorLabel?: unknown;
  notes?: unknown;
  seatLabel?: unknown;
  seatLabels?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getSeatLabels(value: unknown, singleValue: unknown) {
  const seatLabels = Array.isArray(value)
    ? value.filter((seatLabel): seatLabel is string => typeof seatLabel === "string")
    : [];
  const singleSeatLabel = clean(singleValue);

  if (singleSeatLabel) {
    seatLabels.push(singleSeatLabel);
  }

  return seatLabels;
}

async function parsePayload(request: Request) {
  const payload = (await request.json()) as BlockPayload;

  return {
    actorLabel: clean(payload.actorLabel) || "Admin Override",
    notes: clean(payload.notes),
    seatLabels: getSeatLabels(payload.seatLabels, payload.seatLabel),
  };
}

function unauthorizedResponse() {
  return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
}

export async function POST(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
    return unauthorizedResponse();
  }

  try {
    const payload = await parsePayload(request);
    const result = await blockSeatsForAdmin(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Seat blocking failed." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
    return unauthorizedResponse();
  }

  try {
    const payload = await parsePayload(request);
    const result = await unblockSeatsForAdmin(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Seat unblocking failed." },
      { status: 500 },
    );
  }
}
