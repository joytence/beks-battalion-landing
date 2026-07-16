import { NextResponse } from "next/server";
import { sendAdminIssuedTicketSms, normalizePhoneNumber } from "@/lib/ticket-sms";
import {
  getTicketAdminSecret,
  getTicketOrderById,
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  TicketingStoreError,
  updateTicketOrderPurchaserPhone,
} from "@/lib/ticketing-store";

type TextIssuedPayload = {
  orderId?: unknown;
  recipientPhone?: unknown;
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

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return NextResponse.json({ message: "Twilio SMS is not configured yet." }, { status: 500 });
    }

    if (getAuthorizedSecret(request) !== getTicketAdminSecret()) {
      return unauthorizedResponse();
    }

    const payload = (await request.json()) as TextIssuedPayload;
    const orderId = clean(payload.orderId);
    const recipientPhone = clean(payload.recipientPhone);

    if (!orderId) {
      return NextResponse.json({ message: "Order ID is required." }, { status: 400 });
    }

    let order = await getTicketOrderById(orderId);

    if (!order || order.orderStatus !== "paid" || order.tickets.length < 1) {
      return NextResponse.json({ message: "Issued ticket order could not be found." }, { status: 404 });
    }

    if (recipientPhone) {
      const normalizedPhone = normalizePhoneNumber(recipientPhone);

      if (!normalizedPhone) {
        return NextResponse.json({ message: "Recipient phone number is invalid." }, { status: 400 });
      }

      if (normalizedPhone !== normalizePhoneNumber(order.purchaserPhone || "")) {
        const updatedOrder = await updateTicketOrderPurchaserPhone(orderId, normalizedPhone);

        if (!updatedOrder) {
          return NextResponse.json({ message: "Issued ticket order could not be updated." }, { status: 404 });
        }

        order = updatedOrder;
      }
    }

    if (!normalizePhoneNumber(order.purchaserPhone || "")) {
      return NextResponse.json({ message: "Recipient phone number is missing on this issued order." }, { status: 400 });
    }

    const smsResult = await sendAdminIssuedTicketSms(order);

    return NextResponse.json({
      message: `Admission pass text sent to ${smsResult.purchaserPhone}.`,
      purchaserPhone: smsResult.purchaserPhone,
      receiptUrl: smsResult.receiptUrl,
      seats: order.tickets.map((ticket) => ticket.seatLabel),
    });
  } catch (error) {
    console.error("Admin issued text route error:", error);

    const status = error instanceof TicketingStoreError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "The ticket text could not be sent.";

    return NextResponse.json({ message }, { status });
  }
}
