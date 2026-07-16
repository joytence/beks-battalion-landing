import { NextResponse } from "next/server";
import { getAdminIssuedReceiptPath } from "@/lib/ticketing";
import {
  getTicketAdminSecret,
  isTicketAdminConfigured,
  issueBlockedSeatsForAdmin,
  TicketingStoreError,
} from "@/lib/ticketing-store";

type IssuePayload = {
  actorLabel?: unknown;
  notes?: unknown;
  purchaserEmail?: unknown;
  purchaserName?: unknown;
  purchaserPhone?: unknown;
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

function getAuthorizedSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-ticket-admin-secret")?.trim() || "";
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

  if (getAuthorizedSecret(request) !== getTicketAdminSecret()) {
    return unauthorizedResponse();
  }

  try {
    const payload = (await request.json()) as IssuePayload;
    const result = await issueBlockedSeatsForAdmin({
      actorLabel: clean(payload.actorLabel) || "Admin Issue",
      notes: clean(payload.notes),
      purchaserEmail: clean(payload.purchaserEmail),
      purchaserName: clean(payload.purchaserName),
      purchaserPhone: clean(payload.purchaserPhone),
      seatLabels: getSeatLabels(payload.seatLabels, payload.seatLabel),
    });

    const secureReceiptUrl = getAdminIssuedReceiptPath(result.orderId);

    return NextResponse.json({
      ...result,
      purchaserEmail: result.purchaserEmail || clean(payload.purchaserEmail),
      purchaserPhone: result.purchaserPhone || clean(payload.purchaserPhone),
      receiptUrl: secureReceiptUrl,
      secureReceiptUrl,
    });
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Admin ticket issue failed." },
      { status: 500 },
    );
  }
}
