import { NextResponse } from "next/server";
import {
  isAuthorizedTicketAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/ticket-admin-auth";
import { isTwilioSmsConfigured, normalizePhoneNumber, sendAnnouncementSms } from "@/lib/ticket-sms";
import { isTicketAdminConfigured } from "@/lib/ticketing-store";

type AnnouncementPayload = {
  confirmed?: unknown;
  message?: unknown;
  recipientPhones?: unknown;
};

const MAX_RECIPIENTS = 250;
const MAX_MESSAGE_LENGTH = 1_200;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    if (!isTicketAdminConfigured()) {
      return NextResponse.json(
        { message: "TICKET_ADMIN_SECRET is not configured yet." },
        { status: 500 },
      );
    }

    if (!isTwilioSmsConfigured()) {
      return NextResponse.json({ message: "Twilio SMS is not configured yet." }, { status: 500 });
    }

    if (!(await isAuthorizedTicketAdminRequest(request))) {
      return unauthorizedAdminResponse();
    }

    const payload = (await request.json().catch(() => ({}))) as AnnouncementPayload;
    const message = clean(payload.message);
    const rawPhones = Array.isArray(payload.recipientPhones)
      ? payload.recipientPhones.filter((value): value is string => typeof value === "string")
      : [];
    const recipientPhones = Array.from(
      new Set(rawPhones.map(normalizePhoneNumber).filter(Boolean)),
    );

    if (payload.confirmed !== true) {
      return NextResponse.json(
        { message: "Confirm that every recipient agreed to receive this text announcement." },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json({ message: "Write an announcement first." }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { message: `Keep the announcement to ${MAX_MESSAGE_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    if (recipientPhones.length < 1) {
      return NextResponse.json({ message: "Enter at least one valid US or international phone number." }, { status: 400 });
    }

    if (recipientPhones.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { message: `Send no more than ${MAX_RECIPIENTS} recipients in one announcement.` },
        { status: 400 },
      );
    }

    const result = await sendAnnouncementSms({ message, recipientPhones });
    return NextResponse.json({
      failedCount: result.failed.length,
      message: `Sent to ${result.delivered.length} of ${recipientPhones.length} recipient${recipientPhones.length === 1 ? "" : "s"}.`,
      sentCount: result.delivered.length,
    });
  } catch (error) {
    console.error("Ticket announcement route error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "The announcement could not be sent." },
      { status: 500 },
    );
  }
}
