import { NextResponse } from "next/server";
import { getAdminIssuedReceiptUrl, eventDetails, formatCurrency, formatEventDate, getTicketTierById } from "@/lib/ticketing";
import {
  getAuthorizedAdminSecret,
  getTicketAdminSecret,
  getTicketOrderById,
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  updateTicketOrderPurchaserEmail,
} from "@/lib/ticketing-store";

const sender = "Joy Stage Productions <inquiries@joystageproductions.com>";
const facebookPageUrl = "https://www.facebook.com/profile.php?id=61591769009057";

type EmailIssuedPayload = {
  orderId?: unknown;
  recipientEmail?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unauthorizedResponse() {
  return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (!isTicketingDatabaseConfigured()) {
    return NextResponse.json({ message: "DATABASE_URL is required first." }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ message: "RESEND_API_KEY is not configured yet." }, { status: 500 });
  }

  if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
    return unauthorizedResponse();
  }

  const payload = (await request.json()) as EmailIssuedPayload;
  const orderId = clean(payload.orderId);
  const recipientEmail = clean(payload.recipientEmail);

  if (!orderId) {
    return NextResponse.json({ message: "Order ID is required." }, { status: 400 });
  }

  let order = await getTicketOrderById(orderId);

  if (!order || order.orderStatus !== "paid" || order.tickets.length < 1) {
    return NextResponse.json({ message: "Issued ticket order could not be found." }, { status: 404 });
  }

  if (recipientEmail && !isValidEmail(recipientEmail)) {
    return NextResponse.json({ message: "Recipient email is invalid." }, { status: 400 });
  }

  if (recipientEmail && recipientEmail !== order.purchaserEmail) {
    const updatedOrder = await updateTicketOrderPurchaserEmail(orderId, recipientEmail);

    if (!updatedOrder) {
      return NextResponse.json({ message: "Issued ticket order could not be updated." }, { status: 404 });
    }

    order = updatedOrder;
  }

  if (!order.purchaserEmail) {
    return NextResponse.json({ message: "Recipient email is missing on this issued order." }, { status: 400 });
  }

  const tier = getTicketTierById(order.ticketTierId);

  if (!tier) {
    return NextResponse.json({ message: "Ticket tier could not be resolved." }, { status: 500 });
  }

  const eventDate = formatEventDate(eventDetails.dateIso);
  const seatList = order.tickets.map((ticket) => ticket.seatLabel).join(", ");
  const receiptUrl = getAdminIssuedReceiptUrl(order.id);
  const subject = `${eventDetails.name} Admission Passes for ${order.purchaserName}`;
  const text = [
    `Hello ${order.purchaserName},`,
    "",
    `Your admission passes for ${eventDetails.name} are ready.`,
    "",
    "Please use the secure link below to open or print your pass page. Your QR codes will be shown there for entry.",
    "",
    `Event: ${eventDetails.name}`,
    `Date: ${eventDate}`,
    `Venue: ${eventDetails.venue}`,
    `Seats: ${seatList}`,
    `Tier: ${tier.name}`,
    `Admission Value: ${formatCurrency(order.amountTotal || 0, order.currency)}`,
    "",
    "Open or print your passes here:",
    receiptUrl,
    "",
    "The pass page includes the QR codes required for entry.",
    "",
    "For event updates, follow us on Facebook:",
    facebookPageUrl,
    "",
    "If you are excited about the show, please share our Facebook page with others.",
    "",
    "Thank you,",
    "Joy Stage Productions",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 16px;">${escapeHtml(eventDetails.name)} Admission Passes</h2>
      <p style="margin: 0 0 16px;">Hello ${escapeHtml(order.purchaserName)},</p>
      <p style="margin: 0 0 18px;">Your admission passes are ready. Please use the secure link below to open or print your pass page with QR codes for entry.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 720px; margin: 0 0 20px;">
        <tbody>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Event</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(eventDetails.name)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Date</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(eventDate)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Venue</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(eventDetails.venue)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Recipient</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(order.purchaserName)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Seats</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(seatList)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Tier</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(tier.name)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Admission Value</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(formatCurrency(order.amountTotal || 0, order.currency))}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin: 0 0 18px;">
        <a href="${escapeHtml(receiptUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #111; color: #fff; text-decoration: none; font-weight: 700;">
          Open Printable Passes
        </a>
      </p>
      <p style="margin: 0 0 16px; color: #444;">If the button does not open, use this secure link:<br /><a href="${escapeHtml(receiptUrl)}">${escapeHtml(receiptUrl)}</a></p>
      <p style="margin: 0 0 12px;">For event updates, follow us on Facebook: <a href="${escapeHtml(facebookPageUrl)}">${escapeHtml(facebookPageUrl)}</a></p>
      <p style="margin: 0 0 18px;">If you are excited about the show, please share our Facebook page with others.</p>
      <p style="margin: 0;">Thank you,<br />Joy Stage Productions</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      html,
      subject,
      text,
      to: [order.purchaserEmail],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend admin issued ticket email error:", error);

    return NextResponse.json(
      { message: "The ticket email could not be sent yet. Please try again soon." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    message: `Admission pass email sent to ${order.purchaserEmail}.`,
    purchaserEmail: order.purchaserEmail,
    receiptUrl,
    seats: order.tickets.map((ticket) => ticket.seatLabel),
  });
}
