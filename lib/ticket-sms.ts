import {
  eventDetails,
  formatEventDate,
  getAdminIssuedReceiptUrl,
  getStripeReceiptUrl,
  getTicketTierById,
} from "@/lib/ticketing";
import type { getTicketOrderByCheckoutSessionId, getTicketOrderById } from "@/lib/ticketing-store";

type AdminIssuedOrderWithTickets = NonNullable<Awaited<ReturnType<typeof getTicketOrderById>>>;
type PaidOrderWithTickets = NonNullable<Awaited<ReturnType<typeof getTicketOrderByCheckoutSessionId>>>;

function cleanDigits(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    const digits = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return /^\+\d{8,15}$/.test(digits) ? digits : "";
  }

  const digitsOnly = cleanDigits(trimmed).replace(/\+/g, "");

  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`;
  }

  return "";
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() || "";
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || "";

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return null;
  }

  return {
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
  };
}

export function isTwilioSmsConfigured() {
  return Boolean(getTwilioConfig());
}

function buildAdminIssuedTicketSms(order: AdminIssuedOrderWithTickets) {
  const tier = getTicketTierById(order.ticketTierId);

  if (!tier) {
    throw new Error("Ticket tier could not be resolved for this issued order.");
  }

  const eventDate = formatEventDate(eventDetails.dateIso);
  const seatList = order.tickets.map((ticket) => ticket.seatLabel).join(", ");
  const receiptUrl = getAdminIssuedReceiptUrl(order.id);
  const recipientName = order.purchaserName || "Guest";
  const message = [
    `Hi ${recipientName}, your Joy Stage Productions pass is ready.`,
    `${eventDetails.name}`,
    `${eventDate}`,
    `Seats: ${seatList}`,
    `Tier: ${tier.name}`,
    `Open your printable pass: ${receiptUrl}`,
  ].join("\n");

  return { message, receiptUrl };
}

function buildPaidTicketSms(order: PaidOrderWithTickets, livemode: boolean) {
  const tier = getTicketTierById(order.ticketTierId);

  if (!tier) {
    throw new Error("Ticket tier could not be resolved for this paid order.");
  }

  if (!order.checkoutSessionId) {
    throw new Error("Checkout session is missing for this paid order.");
  }

  const eventDate = formatEventDate(eventDetails.dateIso);
  const seatList = order.tickets.map((ticket) => ticket.seatLabel).join(", ");
  const receiptUrl = getStripeReceiptUrl(order.checkoutSessionId);
  const recipientName = order.purchaserName || "Guest";
  const modeLine = livemode ? "" : "Test mode only.";
  const message = [
    `Hi ${recipientName}, your Joy Stage Productions tickets are ready.`,
    `${eventDetails.name}`,
    `${eventDate}`,
    `Seats: ${seatList}`,
    `Tier: ${tier.name}`,
    modeLine,
    `Open or print your tickets: ${receiptUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { message, receiptUrl };
}

async function sendTicketSms({
  message,
  purchaserPhone,
}: {
  message: string;
  purchaserPhone: string;
}) {
  const twilio = getTwilioConfig();

  if (!twilio) {
    throw new Error("Twilio SMS is not configured yet.");
  }

  const to = normalizePhoneNumber(purchaserPhone || "");

  if (!to) {
    throw new Error("Recipient phone number is missing or invalid for this order.");
  }

  const body = new URLSearchParams({
    Body: message,
    To: to,
    ...(twilio.messagingServiceSid
      ? { MessagingServiceSid: twilio.messagingServiceSid }
      : { From: twilio.fromNumber }),
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Twilio ticket SMS error:", error);

    if (error.includes('"code":20003') || error.includes("Primary compliance profile is not approved")) {
      throw new Error(
        "Twilio is blocking SMS because the compliance profile is not approved yet in Trust Hub.",
      );
    }

    throw new Error("The ticket text could not be sent yet. Please try again soon.");
  }

  return {
    purchaserPhone: to,
  };
}

export async function sendAdminIssuedTicketSms(order: AdminIssuedOrderWithTickets) {
  const { message, receiptUrl } = buildAdminIssuedTicketSms(order);
  const smsResult = await sendTicketSms({
    message,
    purchaserPhone: order.purchaserPhone || "",
  });

  return {
    purchaserPhone: smsResult.purchaserPhone,
    receiptUrl,
  };
}

export async function sendReservedSeatReceiptSms({
  livemode,
  order,
}: {
  livemode: boolean;
  order: PaidOrderWithTickets;
}) {
  const { message, receiptUrl } = buildPaidTicketSms(order, livemode);
  const smsResult = await sendTicketSms({
    message,
    purchaserPhone: order.purchaserPhone || "",
  });

  return {
    purchaserPhone: smsResult.purchaserPhone,
    receiptUrl,
  };
}
