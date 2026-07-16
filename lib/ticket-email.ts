import { eventDetails, formatCurrency, formatEventDate, getStripeReceiptUrl, getTicketTierById } from "@/lib/ticketing";
import type { getTicketOrderByCheckoutSessionId } from "@/lib/ticketing-store";

const sender = "Joy Stage Productions <inquiries@joystageproductions.com>";
const facebookPageUrl = "https://www.facebook.com/profile.php?id=61591769009057";

type TicketOrderWithTickets = NonNullable<Awaited<ReturnType<typeof getTicketOrderByCheckoutSessionId>>>;

type CustomerReceiptEmailContentParams = {
  eventDate: string;
  facebookPageUrl: string;
  introLine: string;
  livemode: boolean;
  orderTotalLabel: string;
  purchaserName: string;
  receiptUrl: string;
  receiptUrlLabel: string;
  seatList: string;
  tierName: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildCustomerReceiptEmailContent({
  eventDate,
  facebookPageUrl,
  introLine,
  livemode,
  orderTotalLabel,
  purchaserName,
  receiptUrl,
  receiptUrlLabel,
  seatList,
  tierName,
}: CustomerReceiptEmailContentParams) {
  const testModeNotice = livemode
    ? ""
    : "Stripe test mode was used for this order. These tickets are for testing only.\n\n";
  const text = [
    `Hello ${purchaserName},`,
    "",
    introLine,
    "",
    testModeNotice
      ? testModeNotice.trimEnd()
      : "Please use the secure link below to open or print your ticket page. Your QR codes will be shown there for entry.",
    livemode ? "" : "Please use the secure link below to open or print your ticket page. Your QR codes will be shown there for entry.",
    "",
    `Event: ${eventDetails.name}`,
    `Date: ${eventDate}`,
    `Venue: ${eventDetails.venue}`,
    `Seats: ${seatList}`,
    `Tier: ${tierName}`,
    `Order Total: ${orderTotalLabel}`,
    "",
    `${receiptUrlLabel}:`,
    receiptUrl,
    "",
    "The ticket page includes the QR codes required for entry.",
    "",
    "For event updates, follow us on Facebook:",
    facebookPageUrl,
    "",
    "If you are excited about the show, please share our Facebook page with others.",
    "",
    "Thank you,",
    "Joy Stage Productions",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin: 0 0 16px;">${escapeHtml(eventDetails.name)} Tickets</h2>
      <p style="margin: 0 0 16px;">Hello ${escapeHtml(purchaserName)},</p>
      <p style="margin: 0 0 16px;">${escapeHtml(introLine)}</p>
      ${
        livemode
          ? ""
          : `<p style="margin: 0 0 16px; color: #8a5a00;"><strong>Stripe test mode was used for this order.</strong> These tickets are for testing only.</p>`
      }
      <p style="margin: 0 0 18px;">Please use the secure link below to open or print your ticket page with QR codes for entry.</p>
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
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(purchaserName)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Seats</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(seatList)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Tier</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(tierName)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">Order Total</th>
            <td style="border: 1px solid #ddd; padding: 10px;">${escapeHtml(orderTotalLabel)}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin: 0 0 18px;">
        <a href="${escapeHtml(receiptUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #111; color: #fff; text-decoration: none; font-weight: 700;">
          Open Printable Tickets
        </a>
      </p>
      <p style="margin: 0 0 16px; color: #444;">If the button does not open, use this secure link:<br /><a href="${escapeHtml(receiptUrl)}">${escapeHtml(receiptUrl)}</a></p>
      <p style="margin: 0 0 12px;">For event updates, follow us on Facebook: <a href="${escapeHtml(facebookPageUrl)}">${escapeHtml(facebookPageUrl)}</a></p>
      <p style="margin: 0 0 18px;">If you are excited about the show, please share our Facebook page with others.</p>
      <p style="margin: 0;">Thank you,<br />Joy Stage Productions</p>
    </div>
  `;

  return { html, text };
}

export async function sendReservedSeatReceiptEmail({
  livemode,
  order,
}: {
  livemode: boolean;
  order: TicketOrderWithTickets;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured yet.");
  }

  if (!order.purchaserEmail) {
    throw new Error("Purchaser email is missing for this paid order.");
  }

  const tier = getTicketTierById(order.ticketTierId);

  if (!tier) {
    throw new Error("Ticket tier could not be resolved for the paid order.");
  }

  const eventDate = formatEventDate(eventDetails.dateIso);
  const seatList = order.tickets.map((ticket) => ticket.seatLabel).join(", ");
  const receiptUrl = getStripeReceiptUrl(order.checkoutSessionId);
  const subject = `${eventDetails.name} Tickets for ${order.purchaserName || "Guest"}`;
  const { html, text } = buildCustomerReceiptEmailContent({
    eventDate,
    facebookPageUrl,
    introLine: `Thank you for your purchase for ${eventDetails.name}.`,
    livemode,
    orderTotalLabel: formatCurrency(order.amountTotal || 0, order.currency),
    purchaserName: order.purchaserName || "Guest",
    receiptUrl,
    receiptUrlLabel: "Open or print your tickets here",
    seatList,
    tierName: tier.name,
  });

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
    console.error("Resend reserved-seat ticket email error:", error);
    throw new Error("The ticket email could not be sent yet. Please try again soon.");
  }
}

export async function sendSampleReservedSeatReceiptEmail(recipientEmail: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured yet.");
  }

  const eventDate = formatEventDate(eventDetails.dateIso);
  const subject = `${eventDetails.name} Tickets Email Preview`;
  const { html, text } = buildCustomerReceiptEmailContent({
    eventDate,
    facebookPageUrl,
    introLine:
      `This is a live-format preview of the ticket purchase confirmation email for ${eventDetails.name}.`,
    livemode: true,
    orderTotalLabel: "$450.00",
    purchaserName: "Reyjenald Tence",
    receiptUrl: "https://www.joystageproductions.com/tickets",
    receiptUrlLabel: "View the ticket page here",
    seatList: "SA1-1, SA1-2, SA1-3",
    tierName: "SVIP",
  });

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
      to: [recipientEmail],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend sample ticket email error:", error);
    throw new Error("The sample ticket email could not be sent yet. Please try again soon.");
  }
}
