import { NextResponse } from "next/server";
import {
  getAuthorizedAdminSecret,
  getTicketAdminSecret,
  isTicketAdminConfigured,
  releasePaidSeatsForAdmin,
  TicketingStoreError,
} from "@/lib/ticketing-store";

type ReleasePayload = {
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

export async function POST(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
    return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
  }

  const payload = (await request.json()) as ReleasePayload;

  try {
    const result = await releasePaidSeatsForAdmin({
      actorLabel: clean(payload.actorLabel) || "Admin Override",
      notes: clean(payload.notes),
      seatLabels: getSeatLabels(payload.seatLabels, payload.seatLabel),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Paid seat release failed." },
      { status: 500 },
    );
  }
}
