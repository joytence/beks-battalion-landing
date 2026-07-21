import { NextResponse } from "next/server";
import { sendReservedSeatReceiptEmail } from "@/lib/ticket-email";
import {
  isTwilioSmsConfigured,
  normalizePhoneNumber,
  sendReservedSeatReceiptSms,
} from "@/lib/ticket-sms";
import { getStripeReceiptUrl } from "@/lib/ticketing";
import {
  getTicketAdminSecret,
  getTicketOrderByCheckoutSessionId,
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  TicketingStoreError,
  updateTicketOrderPurchaserEmail,
  updateTicketOrderPurchaserPhone,
} from "@/lib/ticketing-store";

type ResendPaidPayload = {
  channel?: unknown;
  checkoutSessionId?: unknown;
  recipientEmail?: unknown;
  recipientPhone?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function isLiveCheckoutSession(sessionId: string) {
  return !sessionId.startsWith("cs_test_");
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

    if (getAuthorizedSecret(request) !== getTicketAdminSecret()) {
      return unauthorizedResponse();
    }

    const payload = (await request.json()) as ResendPaidPayload;
    const channel = clean(payload.channel).toLowerCase();
    const checkoutSessionId = clean(payload.checkoutSessionId);

    if (channel !== "email" && channel !== "text") {
      return NextResponse.json({ message: "A valid resend channel is required." }, { status: 400 });
    }

    if (!checkoutSessionId) {
      return NextResponse.json({ message: "Checkout session ID is required." }, { status: 400 });
    }

    if (channel === "email" && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ message: "RESEND_API_KEY is not configured yet." }, { status: 500 });
    }

    if (channel === "text" && !isTwilioSmsConfigured()) {
      return NextResponse.json({ message: "Twilio SMS is not configured yet." }, { status: 500 });
    }

    let order = await getTicketOrderByCheckoutSessionId(checkoutSessionId);

    if (!order || order.orderStatus !== "paid" || order.tickets.length < 1) {
      return NextResponse.json({ message: "Paid ticket order could not be found." }, { status: 404 });
    }

    if (channel === "email") {
      const recipientEmail = clean(payload.recipientEmail);

      if (recipientEmail && !isValidEmail(recipientEmail)) {
        return NextResponse.json({ message: "Recipient email is invalid." }, { status: 400 });
      }

      if (recipientEmail && recipientEmail !== order.purchaserEmail) {
        const updatedOrder = await updateTicketOrderPurchaserEmail(order.id, recipientEmail);

        if (!updatedOrder) {
          return NextResponse.json({ message: "Paid ticket order could not be updated." }, { status: 404 });
        }

        order = updatedOrder;
      }

      if (!order.purchaserEmail) {
        return NextResponse.json({ message: "Recipient email is missing on this paid order." }, { status: 400 });
      }

      await sendReservedSeatReceiptEmail({
        livemode: isLiveCheckoutSession(order.checkoutSessionId),
        order,
      });

      return NextResponse.json({
        message: `Paid ticket email sent to ${order.purchaserEmail}.`,
        purchaserEmail: order.purchaserEmail,
        receiptUrl: getStripeReceiptUrl(order.checkoutSessionId),
        seats: order.tickets.map((ticket) => ticket.seatLabel),
      });
    }

    const recipientPhone = clean(payload.recipientPhone);

    if (recipientPhone) {
      const normalizedPhone = normalizePhoneNumber(recipientPhone);

      if (!normalizedPhone) {
        return NextResponse.json({ message: "Recipient phone number is invalid." }, { status: 400 });
      }

      if (normalizedPhone !== normalizePhoneNumber(order.purchaserPhone || "")) {
        const updatedOrder = await updateTicketOrderPurchaserPhone(order.id, normalizedPhone);

        if (!updatedOrder) {
          return NextResponse.json({ message: "Paid ticket order could not be updated." }, { status: 404 });
        }

        order = updatedOrder;
      }
    }

    if (!normalizePhoneNumber(order.purchaserPhone || "")) {
      return NextResponse.json({ message: "Recipient phone number is missing on this paid order." }, { status: 400 });
    }

    const smsResult = await sendReservedSeatReceiptSms({
      livemode: isLiveCheckoutSession(order.checkoutSessionId),
      order,
    });

    return NextResponse.json({
      message: `Paid ticket text sent to ${smsResult.purchaserPhone}.`,
      purchaserPhone: smsResult.purchaserPhone,
      receiptUrl: smsResult.receiptUrl,
      seats: order.tickets.map((ticket) => ticket.seatLabel),
    });
  } catch (error) {
    console.error("Paid ticket resend route error:", error);

    const status = error instanceof TicketingStoreError ? error.status : 500;
    const message = error instanceof Error ? error.message : "The paid ticket could not be resent.";

    return NextResponse.json({ message }, { status });
  }
}
