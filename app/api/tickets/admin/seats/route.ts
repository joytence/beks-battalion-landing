import { NextResponse } from "next/server";
import {
  eventDetails,
  getTicketSeatChart,
  getTicketTierById,
  type TicketTierId,
} from "@/lib/ticketing";
import {
  getAdminSeatDatabaseRecords,
  getAuthorizedAdminSecret,
  getTicketAdminSecret,
  isTicketAdminConfigured,
  isTicketingDatabaseConfigured,
  TicketingStoreError,
  type AdminSeatDatabaseHoldRecord,
  type AdminSeatDatabaseTicketRecord,
} from "@/lib/ticketing-store";

type AdminSeatStatus =
  | "available"
  | "blocked"
  | "converted"
  | "expired"
  | "held"
  | "paid"
  | "released";

type SeatSummary = Record<AdminSeatStatus | "total" | "unavailable", number>;

type AdminSeatResponseRecord = {
  amountTotal: number | null;
  blockId: string;
  blockLabel: string;
  checkoutFlow: string | null;
  checkoutSessionId: string | null;
  currency: string | null;
  expiresAt: string | null;
  holdStatus: string | null;
  isUnavailable: boolean;
  label: string;
  layoutLabel: string;
  number: number | null;
  orderId: string | null;
  orderStatus: string | null;
  paidAt: string | null;
  purchaserEmail: string;
  purchaserName: string;
  purchaserPhone: string;
  row: string;
  seatAssignmentMode: string | null;
  status: AdminSeatStatus;
  ticketId: string | null;
  ticketIndex: number | null;
  ticketStatus: string | null;
  ticketTierId: string;
  tierName: string;
  updatedAt: string | null;
};

function normalizeSeatLabel(value: string) {
  return value.trim().toUpperCase();
}

function getIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isActiveHold(hold: AdminSeatDatabaseHoldRecord, now: number) {
  return hold.holdStatus === "held" && new Date(hold.expiresAt).getTime() > now;
}

function getSeatStatus(
  hold: AdminSeatDatabaseHoldRecord | undefined,
  ticket: AdminSeatDatabaseTicketRecord | undefined,
  now: number,
): AdminSeatStatus {
  if (ticket?.orderStatus === "paid" && ticket.ticketStatus === "active") {
    return "paid";
  }

  if (!hold) {
    return "available";
  }

  if (hold.holdStatus === "blocked") {
    return "blocked";
  }

  if (isActiveHold(hold, now)) {
    return "held";
  }

  if (hold.holdStatus === "converted") {
    return "converted";
  }

  if (hold.holdStatus === "released") {
    return "released";
  }

  return "expired";
}

function getContactRecord(
  hold: AdminSeatDatabaseHoldRecord | undefined,
  ticket: AdminSeatDatabaseTicketRecord | undefined,
) {
  return ticket || hold;
}

function createEmptySummary(): SeatSummary {
  return {
    available: 0,
    blocked: 0,
    converted: 0,
    expired: 0,
    held: 0,
    paid: 0,
    released: 0,
    total: 0,
    unavailable: 0,
  };
}

async function handleSeatDatabaseRequest(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (getAuthorizedAdminSecret(request) !== getTicketAdminSecret()) {
    return NextResponse.json({ message: "Admin authorization failed." }, { status: 401 });
  }

  if (!isTicketingDatabaseConfigured()) {
    return NextResponse.json(
      { message: "DATABASE_URL is not configured for ticketing." },
      { status: 500 },
    );
  }

  try {
    const now = Date.now();
    const chart = getTicketSeatChart();
    const { holds, tickets } = await getAdminSeatDatabaseRecords();
    const holdBySeat = new Map(holds.map((hold) => [normalizeSeatLabel(hold.seatLabel), hold]));
    const ticketBySeat = new Map(tickets.map((ticket) => [normalizeSeatLabel(ticket.seatLabel), ticket]));
    const seenSeatLabels = new Set<string>();

    const generatedSeats = chart.blocks.flatMap((block) =>
      block.rows.flatMap((row) =>
        row.seats.map((seat) => ({
          blockId: block.id,
          blockLabel: block.blockLabel,
          label: normalizeSeatLabel(seat.label),
          layoutLabel: seat.layoutLabel,
          number: seat.number,
          row: seat.row,
          tierId: seat.tierId,
        })),
      ),
    );

    const seats: AdminSeatResponseRecord[] = generatedSeats.map((seat) => {
      seenSeatLabels.add(seat.label);

      const hold = holdBySeat.get(seat.label);
      const ticket = ticketBySeat.get(seat.label);
      const contact = getContactRecord(hold, ticket);
      const status = getSeatStatus(hold, ticket, now);
      const tier = getTicketTierById((contact?.ticketTierId || seat.tierId) as TicketTierId);

      return {
        amountTotal: contact?.amountTotal ?? null,
        blockId: seat.blockId,
        blockLabel: seat.blockLabel,
        checkoutFlow: contact?.checkoutFlow ?? null,
        checkoutSessionId: contact?.checkoutSessionId ?? null,
        currency: contact?.currency ?? null,
        expiresAt: getIsoDate(hold?.expiresAt),
        holdStatus: hold?.holdStatus ?? null,
        isUnavailable: status === "paid" || status === "converted" || status === "blocked" || status === "held",
        label: seat.label,
        layoutLabel: seat.layoutLabel,
        number: seat.number,
        orderId: contact?.orderId ?? null,
        orderStatus: contact?.orderStatus ?? null,
        paidAt: getIsoDate(contact?.paidAt),
        purchaserEmail: contact?.purchaserEmail ?? "",
        purchaserName: contact?.purchaserName ?? "",
        purchaserPhone: contact?.purchaserPhone ?? "",
        row: seat.row,
        seatAssignmentMode: contact?.seatAssignmentMode ?? null,
        status,
        ticketId: ticket?.ticketId ?? null,
        ticketIndex: ticket?.ticketIndex ?? null,
        ticketStatus: ticket?.ticketStatus ?? null,
        ticketTierId: contact?.ticketTierId ?? seat.tierId,
        tierName: tier?.name ?? seat.tierId,
        updatedAt: getIsoDate(contact?.updatedAt),
      };
    });

    for (const hold of holds) {
      const seatLabel = normalizeSeatLabel(hold.seatLabel);

      if (seenSeatLabels.has(seatLabel)) {
        continue;
      }

      const ticket = ticketBySeat.get(seatLabel);
      const contact = ticket || hold;
      const status = getSeatStatus(hold, ticket, now);
      const tier = getTicketTierById(contact.ticketTierId);

      seats.push({
        amountTotal: contact.amountTotal ?? null,
        blockId: "unknown",
        blockLabel: "Not In Current Map",
        checkoutFlow: contact.checkoutFlow,
        checkoutSessionId: contact.checkoutSessionId ?? null,
        currency: contact.currency ?? null,
        expiresAt: getIsoDate(hold.expiresAt),
        holdStatus: hold.holdStatus,
        isUnavailable: status === "paid" || status === "converted" || status === "blocked" || status === "held",
        label: seatLabel,
        layoutLabel: seatLabel,
        number: null,
        orderId: contact.orderId,
        orderStatus: contact.orderStatus,
        paidAt: getIsoDate(contact.paidAt),
        purchaserEmail: contact.purchaserEmail ?? "",
        purchaserName: contact.purchaserName ?? "",
        purchaserPhone: contact.purchaserPhone ?? "",
        row: "",
        seatAssignmentMode: contact.seatAssignmentMode,
        status,
        ticketId: ticket?.ticketId ?? null,
        ticketIndex: ticket?.ticketIndex ?? null,
        ticketStatus: ticket?.ticketStatus ?? null,
        ticketTierId: contact.ticketTierId,
        tierName: tier?.name ?? contact.ticketTierId,
        updatedAt: getIsoDate(contact.updatedAt),
      });
    }

    const summary = seats.reduce((counts, seat) => {
      counts.total += 1;
      counts[seat.status] += 1;

      if (seat.isUnavailable) {
        counts.unavailable += 1;
      }

      return counts;
    }, createEmptySummary());

    return NextResponse.json({
      event: {
        dateLabel: eventDetails.dateLabel,
        name: eventDetails.name,
        slug: eventDetails.slug,
        venue: eventDetails.venue,
      },
      generatedAt: new Date().toISOString(),
      seats,
      summary,
    });
  } catch (error) {
    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Seat database lookup failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleSeatDatabaseRequest(request);
}

export async function POST(request: Request) {
  return handleSeatDatabaseRequest(request);
}
