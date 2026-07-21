import { NextResponse } from "next/server";
import { sendSampleReservedSeatReceiptEmail } from "@/lib/ticket-email";
import {
  getAuthorizedAdminSecret,
  getTicketAdminSecret,
  isTicketAdminConfigured,
} from "@/lib/ticketing-store";

type SampleEmailPayload = {
  recipientEmail?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ message: "RESEND_API_KEY is not configured yet." }, { status: 500 });
  }

  if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
    return unauthorizedResponse();
  }

  const payload = (await request.json()) as SampleEmailPayload;
  const recipientEmail = clean(payload.recipientEmail);

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ message: "A valid recipient email is required." }, { status: 400 });
  }

  await sendSampleReservedSeatReceiptEmail(recipientEmail);

  return NextResponse.json({
    message: `Sample ticket email sent to ${recipientEmail}.`,
  });
}
