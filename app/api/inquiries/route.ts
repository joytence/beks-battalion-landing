import { NextResponse } from "next/server";
import { getMetaTrackingContext, sendMetaCapiEvent } from "@/lib/meta-capi";

const recipient = "joy.tence@joystageproductions.com";
const sender = "Joy Stage Productions <inquiries@joystageproductions.com>";

type InquiryKind = "ticket" | "sponsor";

type InquiryPayload = {
  businessName?: unknown;
  email?: unknown;
  itemName?: unknown;
  kind?: unknown;
  message?: unknown;
  name?: unknown;
  phone?: unknown;
  quantity?: unknown;
  sourceUrl?: unknown;
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

function buildInquiryLines(payload: {
  businessName: string;
  email: string;
  inquiryLabel: string;
  itemName: string;
  message: string;
  name: string;
  phone: string;
  quantity: string;
}) {
  return [
    ["Inquiry Type", payload.inquiryLabel],
    ["Selected Option", payload.itemName],
    ...(payload.quantity ? [["Ticket Quantity", payload.quantity]] : []),
    ...(payload.businessName ? [["Business Name", payload.businessName]] : []),
    ["Name", payload.name],
    ["Email", payload.email],
    ["Phone", payload.phone || "Not provided"],
    ["Message", payload.message || "Please contact me with more information."],
  ];
}

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { message: "Email service is not configured yet." },
      { status: 500 },
    );
  }

  const payload = (await request.json()) as InquiryPayload;
  const kind = clean(payload.kind) as InquiryKind;
  const itemName = clean(payload.itemName);
  const name = clean(payload.name);
  const email = clean(payload.email);
  const phone = clean(payload.phone);
  const quantity = clean(payload.quantity);
  const businessName = clean(payload.businessName);
  const message = clean(payload.message);
  const sourceUrl = clean(payload.sourceUrl) || request.headers.get("referer") || "";

  if (kind !== "ticket" && kind !== "sponsor") {
    return NextResponse.json({ message: "Please choose a valid inquiry type." }, { status: 400 });
  }

  if (!itemName || !name || !email) {
    return NextResponse.json(
      { message: "Please enter your name and email before sending." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (kind === "ticket" && (!quantity || Number(quantity) < 1)) {
    return NextResponse.json(
      { message: "Please enter the number of tickets desired." },
      { status: 400 },
    );
  }

  if (kind === "sponsor" && !businessName) {
    return NextResponse.json(
      { message: "Please enter the business name." },
      { status: 400 },
    );
  }

  const inquiryLabel = kind === "ticket" ? "Ticket Inquiry" : "Sponsor Inquiry";
  const subject = `Beks Battalion ${inquiryLabel} - ${itemName}`;
  const lines = buildInquiryLines({
    businessName,
    email,
    inquiryLabel,
    itemName,
    message,
    name,
    phone,
    quantity,
  });
  const text = lines.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 16px;">${escapeHtml(subject)}</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tbody>
          ${lines
            .map(
              ([label, value]) => `
                <tr>
                  <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 180px; background: #f6f0df;">
                    ${escapeHtml(label)}
                  </th>
                  <td style="border: 1px solid #ddd; padding: 10px;">
                    ${escapeHtml(value)}
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
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
      reply_to: email,
      subject,
      text,
      to: [recipient],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend inquiry error:", error);

    return NextResponse.json(
      { message: "The message could not be sent yet. Please try again soon." },
      { status: 502 },
    );
  }

  const metaTrackingContext = getMetaTrackingContext(request);
  const metaEvent = await sendMetaCapiEvent({
    ...metaTrackingContext,
    customData: {
      content_category: kind,
      content_name: itemName,
      inquiry_type: inquiryLabel,
      lead_type: kind,
      num_items: quantity ? Number(quantity) : undefined,
      quantity: quantity ? Number(quantity) : undefined,
      currency: "USD",
    },
    email,
    eventName: "Lead",
    eventSourceUrl:
      sourceUrl || "https://www.joystageproductions.com",
    phone,
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || undefined,
  });

  if (!metaEvent.ok) {
    console.error("Meta CAPI inquiry event error:", metaEvent.reason);
  } else if (metaEvent.skipped) {
    console.warn("Meta CAPI inquiry event skipped:", metaEvent.reason);
  } else {
    console.info("Meta CAPI inquiry event sent:", {
      eventName: "Lead",
      inquiryType: kind,
      itemName,
      testEventEnabled: Boolean(process.env.META_TEST_EVENT_CODE?.trim()),
    });
  }

  return NextResponse.json({
    message: "Your message has been sent.",
  });
}
