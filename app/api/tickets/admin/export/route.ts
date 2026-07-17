import { NextResponse } from "next/server";
import {
  getAdminTicketSpreadsheetRecords,
  getTicketAdminSecret,
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  TicketingStoreError,
  type AdminTicketSpreadsheetRecord,
} from "@/lib/ticketing-store";

function getAuthorizedSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-ticket-admin-secret")?.trim() || "";
}

function formatDate(value: Date | null) {
  return value ? value.toISOString() : "";
}

function formatMoney(amountTotal: number | null, currency: string | null) {
  if (typeof amountTotal !== "number") {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    currency: currency || "usd",
    style: "currency",
  }).format(amountTotal / 100);
}

function escapeCsvCell(value: string | number | null | undefined) {
  const rawValue = value === null || value === undefined ? "" : String(value);
  return `"${rawValue.replaceAll('"', '""')}"`;
}

function buildCsv(rows: AdminTicketSpreadsheetRecord[]) {
  const headers = [
    "Row Type",
    "Order ID",
    "Order Status",
    "Order Created At",
    "Order Updated At",
    "Paid At",
    "Checkout Flow",
    "Checkout Session",
    "Ticket Tier",
    "Ticket Tier ID",
    "Ticket Quantity",
    "Seat Assignment Mode",
    "Purchaser Name",
    "Purchaser Email",
    "Purchaser Phone",
    "Amount",
    "Currency",
    "Receipt Email Status",
    "Receipt Email Sent At",
    "Seat Label",
    "Original Seat Label",
    "Hold Status",
    "Hold ID",
    "Hold Created At",
    "Hold Expires At",
    "Ticket ID",
    "Ticket Index",
    "Ticket Status",
    "Ticket Created At",
    "Ticket Updated At",
  ];

  const records = rows.map((row) => [
    row.rowType,
    row.orderId,
    row.orderStatus,
    formatDate(row.orderCreatedAt),
    formatDate(row.orderUpdatedAt),
    formatDate(row.paidAt),
    row.checkoutFlow,
    row.checkoutSessionId,
    row.tierName,
    row.ticketTierId,
    row.ticketQuantity,
    row.seatAssignmentMode,
    row.purchaserName,
    row.purchaserEmail,
    row.purchaserPhone,
    formatMoney(row.amountTotal, row.currency),
    row.currency,
    row.customerReceiptEmailStatus,
    formatDate(row.customerReceiptEmailSentAt),
    row.seatLabel,
    row.originalSeatLabel,
    row.holdStatus,
    row.holdId,
    formatDate(row.holdCreatedAt),
    formatDate(row.holdExpiresAt),
    row.ticketId,
    row.ticketIndex,
    row.ticketStatus,
    formatDate(row.ticketCreatedAt),
    formatDate(row.ticketUpdatedAt),
  ]);

  return [headers, ...records].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (getAuthorizedSecret(request) !== getTicketAdminSecret()) {
    return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
  }

  if (!isTicketingDatabaseConfigured()) {
    return NextResponse.json(
      { message: "DATABASE_URL is not configured for ticketing." },
      { status: 500 },
    );
  }

  try {
    const rows = await getAdminTicketSpreadsheetRecords();
    const csv = buildCsv(rows);
    const fileDate = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-disposition": `attachment; filename="joy-stage-ticket-data-${fileDate}.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Ticket spreadsheet export failed." },
      { status: 500 },
    );
  }
}
