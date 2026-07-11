import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import postgres, { type Sql, type TransactionSql } from "postgres";
import {
  eventDetails,
  getTicketTierById,
  isValidTierSeatLabel,
  parseSeatLabels,
  type TicketCheckoutFlow,
  type TicketTierId,
  validateRequestedSeatSelection,
} from "@/lib/ticketing";

type OrderStatus = "canceled" | "expired" | "failed" | "paid" | "pending";
type SeatHoldStatus = "blocked" | "converted" | "expired" | "held" | "released";
type TicketRecord = {
  id: string;
  orderId: string;
  originalSeatLabel: string;
  seatLabel: string;
  ticketIndex: number;
};

type OrderTicketRecord = TicketRecord & {
  checkoutFlow: TicketCheckoutFlow;
  checkoutSessionId: string;
  currency: string;
  eventSlug: string;
  orderStatus: OrderStatus;
  purchaserEmail: string;
  purchaserName: string;
  ticketQuantity: number;
  ticketTierId: TicketTierId;
};

type CreateReservationParams = {
  seatLabels: string[];
  ticketTierId: TicketTierId;
};

type ReassignTicketParams = {
  actorLabel: string;
  checkoutSessionId: string;
  newSeatLabel: string;
  notes?: string;
  ticketIndex: number;
};

export class TicketingStoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TicketingStoreError";
    this.status = status;
  }
}

let dbClient: postgres.Sql | null = null;
let schemaReadyPromise: Promise<void> | null = null;

const ACTIVE_SEAT_HOLD_STATUSES: readonly SeatHoldStatus[] = ["blocked", "converted", "held"];
const RESERVED_SEAT_HOLD_MINUTES = 30;

function getSeatHoldMinutes() {
  const configured = Number(process.env.TICKET_HOLD_MINUTES || RESERVED_SEAT_HOLD_MINUTES);

  if (!Number.isFinite(configured)) {
    return RESERVED_SEAT_HOLD_MINUTES;
  }

  return Math.min(60, Math.max(30, Math.round(configured)));
}

function getPaymentIntentId(paymentIntent: Stripe.Checkout.Session["payment_intent"]) {
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id || null;
}

function getDb() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new TicketingStoreError("DATABASE_URL is required for reserved-seat checkout.", 500);
  }

  if (!dbClient) {
    dbClient = postgres(databaseUrl, {
      idle_timeout: 20,
      max: 1,
      prepare: false,
      ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : "require",
    });
  }

  return dbClient;
}

async function ensureSchema() {
  if (!schemaReadyPromise) {
    const sql = getDb();

    schemaReadyPromise = (async () => {
      await sql`
        create table if not exists ticket_orders (
          id uuid primary key,
          checkout_session_id text unique,
          payment_intent_id text unique,
          event_slug text not null,
          checkout_flow text not null,
          ticket_tier_id text not null,
          ticket_quantity integer not null,
          currency text,
          amount_total integer,
          purchaser_name text,
          purchaser_email text,
          purchaser_phone text,
          order_status text not null default 'pending',
          seat_assignment_mode text not null default 'reserved',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          paid_at timestamptz
        )
      `;
      await sql`
        create table if not exists ticket_seat_holds (
          id uuid primary key,
          order_id uuid not null references ticket_orders(id) on delete cascade,
          checkout_session_id text,
          event_slug text not null,
          seat_label text not null,
          ticket_tier_id text not null,
          status text not null,
          expires_at timestamptz not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `;
      await sql`
        create table if not exists ticket_tickets (
          id uuid primary key,
          order_id uuid not null references ticket_orders(id) on delete cascade,
          seat_label text not null,
          original_seat_label text not null,
          ticket_index integer not null,
          ticket_status text not null default 'active',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (order_id, ticket_index)
        )
      `;
      await sql`
        create table if not exists ticket_admin_audit (
          id uuid primary key,
          actor_label text not null,
          action_type text not null,
          order_id uuid,
          ticket_id uuid,
          seat_label_from text,
          seat_label_to text,
          notes text,
          created_at timestamptz not null default now()
        )
      `;
      await sql`
        create unique index if not exists ticket_active_seat_hold_idx
        on ticket_seat_holds (event_slug, seat_label)
        where status in ('blocked', 'converted', 'held')
      `;
      await sql`
        create index if not exists ticket_seat_holds_order_status_idx
        on ticket_seat_holds (order_id, status)
      `;
      await sql`
        create index if not exists ticket_orders_status_idx
        on ticket_orders (order_status, event_slug)
      `;
      await sql`
        create index if not exists ticket_tickets_order_idx
        on ticket_tickets (order_id)
      `;
    })();
  }

  await schemaReadyPromise;
}

async function withStore<T>(fn: (sql: Sql) => Promise<T>) {
  await ensureSchema();
  return fn(getDb());
}

async function releaseExpiredSeatHolds(sql: Sql | TransactionSql) {
  await sql`
    update ticket_seat_holds
    set status = 'expired',
        updated_at = now()
    where status = 'held'
      and expires_at <= now()
  `;

  await sql`
    update ticket_orders
    set order_status = 'expired',
        updated_at = now()
    where order_status = 'pending'
      and not exists (
        select 1
        from ticket_seat_holds
        where ticket_seat_holds.order_id = ticket_orders.id
          and ticket_seat_holds.status = 'held'
          and ticket_seat_holds.expires_at > now()
      )
      and exists (
        select 1
        from ticket_seat_holds
        where ticket_seat_holds.order_id = ticket_orders.id
          and ticket_seat_holds.status = 'expired'
      )
  `;
}

async function getUnavailableSeatLabelsForUpdate(sql: Sql | TransactionSql) {
  const rows = await sql<{ seat_label: string }[]>`
    select seat_label
    from ticket_seat_holds
    where event_slug = ${eventDetails.slug}
      and (
        status in ('blocked', 'converted')
        or (status = 'held' and expires_at > now())
      )
  `;

  return new Set(rows.map((row) => row.seat_label.trim().toUpperCase()));
}

export function isTicketingDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isTicketAdminConfigured() {
  return Boolean(process.env.TICKET_ADMIN_SECRET?.trim());
}

export function getTicketAdminSecret() {
  const secret = process.env.TICKET_ADMIN_SECRET?.trim();

  if (!secret) {
    throw new TicketingStoreError("TICKET_ADMIN_SECRET is not configured.", 500);
  }

  return secret;
}

export async function getUnavailableSeatLabels() {
  return withStore(async (sql) => {
    await releaseExpiredSeatHolds(sql);
    return getUnavailableSeatLabelsForUpdate(sql);
  });
}

export async function createReservedSeatCheckoutReservation({
  seatLabels,
  ticketTierId,
}: CreateReservationParams) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      await releaseExpiredSeatHolds(tx);

      const unavailableSeatLabels = await getUnavailableSeatLabelsForUpdate(tx);
      const validation = validateRequestedSeatSelection(ticketTierId, seatLabels, {
        blockedSeatLabels: unavailableSeatLabels,
      });

      if (validation.error) {
        throw new TicketingStoreError(validation.error, 409);
      }

      const orderId = randomUUID();
      const expiresAt = new Date(Date.now() + getSeatHoldMinutes() * 60_000);

      await tx`
        insert into ticket_orders (
          id,
          event_slug,
          checkout_flow,
          ticket_tier_id,
          ticket_quantity,
          order_status,
          seat_assignment_mode
        )
        values (
          ${orderId},
          ${eventDetails.slug},
          'reserved_seat',
          ${ticketTierId},
          ${validation.seatLabels.length},
          'pending',
          'reserved'
        )
      `;

      for (const seatLabel of validation.seatLabels) {
        await tx`
          insert into ticket_seat_holds (
            id,
            order_id,
            event_slug,
            seat_label,
            ticket_tier_id,
            status,
            expires_at
          )
          values (
            ${randomUUID()},
            ${orderId},
            ${eventDetails.slug},
            ${seatLabel},
            ${ticketTierId},
            'held',
            ${expiresAt}
          )
        `;
      }

      return {
        expiresAt,
        orderId,
        seatLabels: validation.seatLabels,
      };
    }),
  );
}

export async function attachCheckoutSessionToReservedOrder(params: {
  checkoutSessionId: string;
  orderId: string;
}) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set checkout_session_id = ${params.checkoutSessionId},
          updated_at = now()
      where id = ${params.orderId}
    `;

    await sql`
      update ticket_seat_holds
      set checkout_session_id = ${params.checkoutSessionId},
          updated_at = now()
      where order_id = ${params.orderId}
    `;
  });
}

export async function releaseReservedSeatOrder(params: {
  orderId: string;
  orderStatus: Exclude<OrderStatus, "paid" | "pending">;
  seatStatus: Exclude<SeatHoldStatus, "blocked" | "converted" | "held">;
}) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      await tx`
        update ticket_seat_holds
        set status = ${params.seatStatus},
            updated_at = now()
        where order_id = ${params.orderId}
          and status = 'held'
      `;

      await tx`
        update ticket_orders
        set order_status = ${params.orderStatus},
            updated_at = now()
        where id = ${params.orderId}
          and order_status = 'pending'
      `;
    }),
  );
}

export async function getOrderTicketsByCheckoutSessionId(checkoutSessionId: string) {
  return withStore(async (sql) => {
    const rows = await sql<OrderTicketRecord[]>`
      select
        ticket_tickets.id,
        ticket_tickets.order_id as "orderId",
        ticket_tickets.original_seat_label as "originalSeatLabel",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        coalesce(ticket_orders.currency, 'usd') as currency,
        ticket_orders.event_slug as "eventSlug",
        ticket_orders.order_status as "orderStatus",
        coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
        coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
        ticket_orders.ticket_quantity as "ticketQuantity",
        ticket_orders.ticket_tier_id as "ticketTierId"
      from ticket_tickets
      inner join ticket_orders on ticket_orders.id = ticket_tickets.order_id
      where ticket_orders.checkout_session_id = ${checkoutSessionId}
      order by ticket_tickets.ticket_index asc
    `;

    return rows;
  });
}

export async function syncReservedSeatPaymentConfirmed(session: Stripe.Checkout.Session) {
  if (session.metadata?.checkout_flow !== "reserved_seat") {
    return;
  }

  const orderId = session.metadata?.order_id?.trim();

  if (!orderId) {
    throw new TicketingStoreError("Stripe session is missing reserved-seat order metadata.", 500);
  }

  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      const orders = await tx<{ id: string; order_status: OrderStatus }[]>`
        select id, order_status
        from ticket_orders
        where id = ${orderId}
        for update
      `;
      const order = orders[0];

      if (!order) {
        throw new TicketingStoreError("Reserved-seat order could not be found for Stripe session.", 404);
      }

      const seatLabels = parseSeatLabels(session.metadata?.seat_labels || "");
      const paymentIntentId = getPaymentIntentId(session.payment_intent);

      await tx`
        update ticket_orders
        set checkout_session_id = ${session.id},
            payment_intent_id = ${paymentIntentId},
            purchaser_name = ${session.customer_details?.name?.trim() || ""},
            purchaser_email = ${session.customer_details?.email?.trim() || ""},
            purchaser_phone = ${session.customer_details?.phone?.trim() || ""},
            currency = ${session.currency || "usd"},
            amount_total = ${session.amount_total || 0},
            order_status = 'paid',
            paid_at = now(),
            updated_at = now()
        where id = ${orderId}
      `;

      await tx`
        update ticket_seat_holds
        set checkout_session_id = ${session.id},
            status = 'converted',
            updated_at = now()
        where order_id = ${orderId}
          and seat_label in ${tx(seatLabels)}
          and status in ('held', 'converted')
      `;

      const existingTickets = await tx<{ ticket_index: number }[]>`
        select ticket_index
        from ticket_tickets
        where order_id = ${orderId}
      `;
      const existingIndexes = new Set(existingTickets.map((ticket) => ticket.ticket_index));

      for (const [index, seatLabel] of seatLabels.entries()) {
        const ticketIndex = index + 1;

        if (existingIndexes.has(ticketIndex)) {
          continue;
        }

        await tx`
          insert into ticket_tickets (
            id,
            order_id,
            seat_label,
            original_seat_label,
            ticket_index
          )
          values (
            ${randomUUID()},
            ${orderId},
            ${seatLabel},
            ${seatLabel},
            ${ticketIndex}
          )
        `;
      }
    }),
  );
}

export async function syncReservedSeatPaymentFailed(session: Stripe.Checkout.Session) {
  if (session.metadata?.checkout_flow !== "reserved_seat") {
    return;
  }

  const orderId = session.metadata?.order_id?.trim();

  if (!orderId) {
    return;
  }

  await releaseReservedSeatOrder({
    orderId,
    orderStatus: "failed",
    seatStatus: "released",
  });
}

export async function syncReservedSeatCheckoutExpired(session: Stripe.Checkout.Session) {
  if (session.metadata?.checkout_flow !== "reserved_seat") {
    return;
  }

  const orderId = session.metadata?.order_id?.trim();

  if (!orderId) {
    return;
  }

  await releaseReservedSeatOrder({
    orderId,
    orderStatus: "expired",
    seatStatus: "expired",
  });
}

export async function reassignReservedSeatTicket({
  actorLabel,
  checkoutSessionId,
  newSeatLabel,
  notes,
  ticketIndex,
}: ReassignTicketParams) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      await releaseExpiredSeatHolds(tx);

      const tickets = await tx<
        {
          id: string;
          order_id: string;
          seat_label: string;
          ticket_tier_id: TicketTierId;
        }[]
      >`
        select
          ticket_tickets.id,
          ticket_tickets.order_id,
          ticket_tickets.seat_label,
          ticket_orders.ticket_tier_id
        from ticket_tickets
        inner join ticket_orders on ticket_orders.id = ticket_tickets.order_id
        where ticket_orders.checkout_session_id = ${checkoutSessionId}
          and ticket_tickets.ticket_index = ${ticketIndex}
        for update
      `;
      const ticket = tickets[0];

      if (!ticket) {
        throw new TicketingStoreError("Ticket could not be found for reassignment.", 404);
      }

      const normalizedSeatLabel = newSeatLabel.trim().toUpperCase();

      if (!isValidTierSeatLabel(ticket.ticket_tier_id, normalizedSeatLabel)) {
        throw new TicketingStoreError("New seat is not valid for this ticket tier.", 400);
      }

      if (normalizedSeatLabel === ticket.seat_label) {
        throw new TicketingStoreError("The ticket is already assigned to that seat.", 400);
      }

      const unavailableSeatLabels = await getUnavailableSeatLabelsForUpdate(tx);
      unavailableSeatLabels.delete(ticket.seat_label.trim().toUpperCase());

      const validation = validateRequestedSeatSelection(ticket.ticket_tier_id, [normalizedSeatLabel], {
        blockedSeatLabels: unavailableSeatLabels,
      });

      if (validation.error) {
        throw new TicketingStoreError(validation.error, 409);
      }

      await tx`
        update ticket_seat_holds
        set status = 'released',
            updated_at = now()
        where order_id = ${ticket.order_id}
          and seat_label = ${ticket.seat_label}
          and status = 'converted'
      `;

      await tx`
        insert into ticket_seat_holds (
          id,
          order_id,
          checkout_session_id,
          event_slug,
          seat_label,
          ticket_tier_id,
          status,
          expires_at
        )
        values (
          ${randomUUID()},
          ${ticket.order_id},
          ${checkoutSessionId},
          ${eventDetails.slug},
          ${normalizedSeatLabel},
          ${ticket.ticket_tier_id},
          'converted',
          now()
        )
      `;

      await tx`
        update ticket_tickets
        set seat_label = ${normalizedSeatLabel},
            updated_at = now()
        where id = ${ticket.id}
      `;

      await tx`
        insert into ticket_admin_audit (
          id,
          actor_label,
          action_type,
          order_id,
          ticket_id,
          seat_label_from,
          seat_label_to,
          notes
        )
        values (
          ${randomUUID()},
          ${actorLabel},
          'seat_reassigned',
          ${ticket.order_id},
          ${ticket.id},
          ${ticket.seat_label},
          ${normalizedSeatLabel},
          ${notes?.trim() || ""}
        )
      `;

      return {
        checkoutSessionId,
        newSeatLabel: normalizedSeatLabel,
        ticketId: ticket.id,
        ticketIndex,
      };
    }),
  );
}
