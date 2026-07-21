import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import postgres, { type Sql, type TransactionSql } from "postgres";
import {
  eventDetails,
  getTierIdForSeatLabel,
  getTicketTierById,
  isValidTierSeatLabel,
  parseSeatLabels,
  type TicketCheckoutFlow,
  type TicketTierId,
  validateRequestedSeatSelection,
} from "@/lib/ticketing";

type OrderStatus = "canceled" | "expired" | "failed" | "paid" | "pending";
type SeatHoldStatus = "blocked" | "converted" | "expired" | "held" | "released";
type TicketStatus = "active" | "canceled";
type TicketRecord = {
  id: string;
  orderId: string;
  originalSeatLabel: string;
  seatLabel: string;
  ticketIndex: number;
  ticketStatus: TicketStatus;
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
  smsConsentOptIn: boolean;
  ticketTierId: TicketTierId;
};

type ReassignTicketParams = {
  actorLabel: string;
  checkoutSessionId: string;
  newSeatLabel: string;
  notes?: string;
  ticketIndex: number;
};

type BlockSeatsParams = {
  actorLabel: string;
  notes?: string;
  seatLabels: string[];
};

type ReleasePaidSeatsParams = {
  actorLabel: string;
  notes?: string;
  seatLabels: string[];
};

type IssueAdminTicketsParams = {
  actorLabel: string;
  notes?: string;
  purchaserEmail?: string;
  purchaserName: string;
  purchaserPhone?: string;
  seatLabels: string[];
};

type TicketOrderRecord = {
  adminSaleEmailLockedAt: Date | null;
  adminSaleEmailSentAt: Date | null;
  adminSaleEmailStatus: string;
  amountTotal: number;
  checkoutFlow: TicketCheckoutFlow;
  checkoutSessionId: string;
  createdAt: Date;
  customerReceiptEmailLockedAt: Date | null;
  customerReceiptEmailSentAt: Date | null;
  customerReceiptEmailStatus: string;
  customerReceiptSmsLockedAt: Date | null;
  customerReceiptSmsSentAt: Date | null;
  customerReceiptSmsStatus: string;
  currency: string;
  eventSlug: string;
  id: string;
  orderStatus: OrderStatus;
  paidAt: Date | null;
  purchaserEmail: string;
  purchaserName: string;
  purchaserPhone: string;
  seatAssignmentMode: string;
  smsConsentOptIn?: boolean;
  ticketQuantity: number;
  ticketTierId: TicketTierId;
  updatedAt: Date;
};

export type AdminSeatDatabaseHoldRecord = {
  amountTotal: number | null;
  checkoutFlow: TicketCheckoutFlow;
  checkoutSessionId: string | null;
  createdAt: Date;
  currency: string | null;
  expiresAt: Date;
  holdId: string;
  holdStatus: SeatHoldStatus;
  orderId: string;
  orderStatus: OrderStatus;
  paidAt: Date | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
  purchaserPhone: string | null;
  seatAssignmentMode: string;
  seatLabel: string;
  ticketQuantity: number;
  ticketTierId: TicketTierId;
  updatedAt: Date;
};

export type AdminSeatDatabaseTicketRecord = {
  amountTotal: number | null;
  checkoutFlow: TicketCheckoutFlow;
  checkoutSessionId: string | null;
  createdAt: Date;
  currency: string | null;
  orderId: string;
  orderStatus: OrderStatus;
  paidAt: Date | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
  purchaserPhone: string | null;
  seatAssignmentMode: string;
  seatLabel: string;
  ticketId: string;
  ticketIndex: number;
  ticketStatus: TicketStatus;
  ticketTierId: TicketTierId;
  updatedAt: Date;
};

type AdminTicketSpreadsheetOrderRecord = {
  amountTotal: number | null;
  checkoutFlow: TicketCheckoutFlow;
  checkoutSessionId: string | null;
  createdAt: Date;
  currency: string | null;
  customerReceiptEmailSentAt: Date | null;
  customerReceiptEmailStatus: string;
  orderId: string;
  orderStatus: OrderStatus;
  paidAt: Date | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
  purchaserPhone: string | null;
  seatAssignmentMode: string;
  ticketQuantity: number;
  ticketTierId: TicketTierId;
  updatedAt: Date;
};

type AdminTicketSpreadsheetHoldRecord = {
  createdAt: Date;
  expiresAt: Date;
  holdId: string;
  holdStatus: SeatHoldStatus;
  orderId: string;
  seatLabel: string;
  updatedAt: Date;
};

type AdminTicketSpreadsheetTicketRecord = {
  createdAt: Date;
  orderId: string;
  originalSeatLabel: string;
  seatLabel: string;
  ticketId: string;
  ticketIndex: number;
  ticketStatus: TicketStatus;
  updatedAt: Date;
};

export type AdminTicketSpreadsheetRecord = {
  amountTotal: number | null;
  checkoutFlow: TicketCheckoutFlow;
  checkoutSessionId: string | null;
  currency: string | null;
  customerReceiptEmailSentAt: Date | null;
  customerReceiptEmailStatus: string;
  holdCreatedAt: Date | null;
  holdExpiresAt: Date | null;
  holdId: string | null;
  holdStatus: SeatHoldStatus | null;
  orderCreatedAt: Date;
  orderId: string;
  orderStatus: OrderStatus;
  orderUpdatedAt: Date;
  originalSeatLabel: string | null;
  paidAt: Date | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
  purchaserPhone: string | null;
  rowType: "hold" | "order" | "ticket" | "ticket+hold";
  seatAssignmentMode: string;
  seatLabel: string | null;
  ticketCreatedAt: Date | null;
  ticketId: string | null;
  ticketIndex: number | null;
  ticketQuantity: number;
  ticketStatus: TicketStatus | null;
  ticketTierId: TicketTierId;
  ticketUpdatedAt: Date | null;
  tierName: string;
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
let schemaVerified = false;

const ACTIVE_SEAT_HOLD_STATUSES: readonly SeatHoldStatus[] = ["blocked", "converted", "held"];
const RESERVED_SEAT_HOLD_MINUTES = 30;

function getSeatHoldMinutes() {
  const configured = Number(process.env.TICKET_HOLD_MINUTES || RESERVED_SEAT_HOLD_MINUTES);

  if (!Number.isFinite(configured)) {
    return RESERVED_SEAT_HOLD_MINUTES;
  }

  return Math.min(60, Math.max(30, Math.round(configured)));
}

function normalizeSeatLabels(seatLabels: string[]) {
  return Array.from(
    new Set(
      seatLabels
        .map((seatLabel) => seatLabel.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function normalizeSeatLabel(seatLabel: string) {
  return seatLabel.trim().toUpperCase();
}

function getPaymentIntentId(paymentIntent: Stripe.Checkout.Session["payment_intent"]) {
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id || null;
}

function getStripePurchaserName(session: Stripe.Checkout.Session) {
  return session.customer_details?.name?.trim() || "";
}

function getStripePurchaserEmail(session: Stripe.Checkout.Session) {
  return session.customer_details?.email?.trim() || session.customer_email?.trim() || "";
}

function getStripePurchaserPhone(session: Stripe.Checkout.Session) {
  return session.customer_details?.phone?.trim() || "";
}

function getAdminIssuedCheckoutSessionId(orderId: string) {
  return `admin_issued_${orderId}`;
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

async function initializeSchema(sql: Sql) {
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
      admin_sale_email_status text not null default 'pending',
      admin_sale_email_locked_at timestamptz,
      admin_sale_email_sent_at timestamptz,
      customer_receipt_email_status text not null default 'pending',
      customer_receipt_email_locked_at timestamptz,
      customer_receipt_email_sent_at timestamptz,
      customer_receipt_sms_status text not null default 'pending',
      customer_receipt_sms_locked_at timestamptz,
      customer_receipt_sms_sent_at timestamptz,
      sms_consent_opt_in boolean not null default false,
      sms_consent_source text,
      sms_consent_updated_at timestamptz,
      seat_assignment_mode text not null default 'reserved',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      paid_at timestamptz
    )
  `;
  await sql`
    alter table ticket_orders
    add column if not exists admin_sale_email_status text not null default 'pending'
  `;
  await sql`
    alter table ticket_orders
    add column if not exists admin_sale_email_locked_at timestamptz
  `;
  await sql`
    alter table ticket_orders
    add column if not exists admin_sale_email_sent_at timestamptz
  `;
  await sql`
    alter table ticket_orders
    add column if not exists customer_receipt_email_status text not null default 'pending'
  `;
  await sql`
    alter table ticket_orders
    add column if not exists customer_receipt_email_locked_at timestamptz
  `;
  await sql`
    alter table ticket_orders
    add column if not exists customer_receipt_email_sent_at timestamptz
  `;
  await sql`
    alter table ticket_orders
    add column if not exists customer_receipt_sms_status text not null default 'pending'
  `;
  await sql`
    alter table ticket_orders
    add column if not exists customer_receipt_sms_locked_at timestamptz
  `;
  await sql`
    alter table ticket_orders
    add column if not exists customer_receipt_sms_sent_at timestamptz
  `;
  await sql`
    alter table ticket_orders
    add column if not exists sms_consent_opt_in boolean not null default false
  `;
  await sql`
    alter table ticket_orders
    add column if not exists sms_consent_source text
  `;
  await sql`
    alter table ticket_orders
    add column if not exists sms_consent_updated_at timestamptz
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
}

async function ensureSchema() {
  if (!schemaReadyPromise) {
    const sql = getDb();

    schemaReadyPromise = (async () => {
      if (schemaVerified) {
        const result = await sql<{ existing_table: string | null }[]>`
          select to_regclass('ticket_orders') as existing_table
        `;

        if (result[0]?.existing_table) {
          return;
        }
      }

      await initializeSchema(sql);
      schemaVerified = true;
    })().finally(() => {
      schemaReadyPromise = null;
    });
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

export function normalizeAdminSecretValue(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .trim();
}

export function isTicketAdminConfigured() {
  return Boolean(normalizeAdminSecretValue(process.env.TICKET_ADMIN_SECRET || ""));
}

export function getTicketAdminSecret() {
  const secret = normalizeAdminSecretValue(process.env.TICKET_ADMIN_SECRET || "");

  if (!secret) {
    throw new TicketingStoreError("TICKET_ADMIN_SECRET is not configured.", 500);
  }

  return secret;
}

export function getAuthorizedAdminSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.startsWith("Bearer ")) {
    return normalizeAdminSecretValue(authorization.slice("Bearer ".length));
  }

  return normalizeAdminSecretValue(request.headers.get("x-ticket-admin-secret") || "");
}

export async function getUnavailableSeatLabels() {
  return withStore(async (sql) => {
    await releaseExpiredSeatHolds(sql);
    return getUnavailableSeatLabelsForUpdate(sql);
  });
}

export async function getAdminSeatDatabaseRecords() {
  return withStore(async (sql) => {
    await releaseExpiredSeatHolds(sql);

    const holds = await sql<AdminSeatDatabaseHoldRecord[]>`
      with ranked_holds as (
        select
          ticket_seat_holds.id as "holdId",
          ticket_seat_holds.order_id as "orderId",
          ticket_seat_holds.seat_label as "seatLabel",
          ticket_seat_holds.ticket_tier_id as "ticketTierId",
          ticket_seat_holds.status as "holdStatus",
          ticket_seat_holds.expires_at as "expiresAt",
          ticket_seat_holds.created_at as "createdAt",
          ticket_seat_holds.updated_at as "updatedAt",
          ticket_orders.checkout_session_id as "checkoutSessionId",
          ticket_orders.checkout_flow as "checkoutFlow",
          ticket_orders.ticket_quantity as "ticketQuantity",
          ticket_orders.currency as "currency",
          ticket_orders.amount_total as "amountTotal",
          ticket_orders.purchaser_name as "purchaserName",
          ticket_orders.purchaser_email as "purchaserEmail",
          ticket_orders.purchaser_phone as "purchaserPhone",
          ticket_orders.order_status as "orderStatus",
          coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
          ticket_orders.paid_at as "paidAt",
          row_number() over (
            partition by upper(ticket_seat_holds.seat_label)
            order by ticket_seat_holds.updated_at desc, ticket_seat_holds.created_at desc
          ) as hold_rank
        from ticket_seat_holds
        inner join ticket_orders on ticket_orders.id = ticket_seat_holds.order_id
        where ticket_seat_holds.event_slug = ${eventDetails.slug}
      )
      select
        "holdId",
        "orderId",
        "seatLabel",
        "ticketTierId",
        "holdStatus",
        "expiresAt",
        "createdAt",
        "updatedAt",
        "checkoutSessionId",
        "checkoutFlow",
        "ticketQuantity",
        "currency",
        "amountTotal",
        "purchaserName",
        "purchaserEmail",
        "purchaserPhone",
        "orderStatus",
        "seatAssignmentMode",
        "paidAt"
      from ranked_holds
      where hold_rank = 1
      order by "seatLabel" asc
    `;

    const tickets = await sql<AdminSeatDatabaseTicketRecord[]>`
      select
        ticket_tickets.id as "ticketId",
        ticket_tickets.order_id as "orderId",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_tickets.ticket_status as "ticketStatus",
        ticket_tickets.created_at as "createdAt",
        ticket_tickets.updated_at as "updatedAt",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.ticket_tier_id as "ticketTierId",
        ticket_orders.currency as "currency",
        ticket_orders.amount_total as "amountTotal",
        ticket_orders.purchaser_name as "purchaserName",
        ticket_orders.purchaser_email as "purchaserEmail",
        ticket_orders.purchaser_phone as "purchaserPhone",
        ticket_orders.order_status as "orderStatus",
        coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
        ticket_orders.paid_at as "paidAt"
      from ticket_tickets
      inner join ticket_orders on ticket_orders.id = ticket_tickets.order_id
      where ticket_orders.event_slug = ${eventDetails.slug}
        and ticket_tickets.ticket_status = 'active'
      order by ticket_tickets.seat_label asc, ticket_tickets.ticket_index asc
    `;

    return { holds, tickets };
  });
}

export async function getAdminTicketSpreadsheetRecords() {
  return withStore(async (sql) => {
    await releaseExpiredSeatHolds(sql);

    const orders = await sql<AdminTicketSpreadsheetOrderRecord[]>`
      select
        ticket_orders.amount_total as "amountTotal",
        ticket_orders.admin_sale_email_locked_at as "adminSaleEmailLockedAt",
        ticket_orders.admin_sale_email_sent_at as "adminSaleEmailSentAt",
        coalesce(ticket_orders.admin_sale_email_status, 'pending') as "adminSaleEmailStatus",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        ticket_orders.created_at as "createdAt",
        ticket_orders.currency as "currency",
        ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
        coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
        ticket_orders.id as "orderId",
        ticket_orders.order_status as "orderStatus",
        ticket_orders.paid_at as "paidAt",
        ticket_orders.purchaser_email as "purchaserEmail",
        ticket_orders.purchaser_name as "purchaserName",
        ticket_orders.purchaser_phone as "purchaserPhone",
        coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
        ticket_orders.ticket_quantity as "ticketQuantity",
        ticket_orders.ticket_tier_id as "ticketTierId",
        ticket_orders.updated_at as "updatedAt"
      from ticket_orders
      where ticket_orders.event_slug = ${eventDetails.slug}
      order by
        coalesce(ticket_orders.paid_at, ticket_orders.updated_at, ticket_orders.created_at) desc,
        ticket_orders.created_at desc
    `;

    const holds = await sql<AdminTicketSpreadsheetHoldRecord[]>`
      with ranked_holds as (
        select
          ticket_seat_holds.id as "holdId",
          ticket_seat_holds.order_id as "orderId",
          ticket_seat_holds.seat_label as "seatLabel",
          ticket_seat_holds.status as "holdStatus",
          ticket_seat_holds.expires_at as "expiresAt",
          ticket_seat_holds.created_at as "createdAt",
          ticket_seat_holds.updated_at as "updatedAt",
          row_number() over (
            partition by ticket_seat_holds.order_id, upper(ticket_seat_holds.seat_label)
            order by ticket_seat_holds.updated_at desc, ticket_seat_holds.created_at desc
          ) as hold_rank
        from ticket_seat_holds
        where ticket_seat_holds.event_slug = ${eventDetails.slug}
      )
      select
        "holdId",
        "orderId",
        "seatLabel",
        "holdStatus",
        "expiresAt",
        "createdAt",
        "updatedAt"
      from ranked_holds
      where hold_rank = 1
      order by "orderId" asc, upper("seatLabel") asc
    `;

    const tickets = await sql<AdminTicketSpreadsheetTicketRecord[]>`
      select
        ticket_tickets.created_at as "createdAt",
        ticket_tickets.order_id as "orderId",
        ticket_tickets.original_seat_label as "originalSeatLabel",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.id as "ticketId",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_tickets.ticket_status as "ticketStatus",
        ticket_tickets.updated_at as "updatedAt"
      from ticket_tickets
      inner join ticket_orders on ticket_orders.id = ticket_tickets.order_id
      where ticket_orders.event_slug = ${eventDetails.slug}
      order by ticket_tickets.order_id asc, ticket_tickets.ticket_index asc
    `;

    const holdsByOrder = new Map<string, AdminTicketSpreadsheetHoldRecord[]>();
    const ticketsByOrder = new Map<string, AdminTicketSpreadsheetTicketRecord[]>();

    for (const hold of holds) {
      const existing = holdsByOrder.get(hold.orderId) || [];
      existing.push(hold);
      holdsByOrder.set(hold.orderId, existing);
    }

    for (const ticket of tickets) {
      const existing = ticketsByOrder.get(ticket.orderId) || [];
      existing.push(ticket);
      ticketsByOrder.set(ticket.orderId, existing);
    }

    const rows: AdminTicketSpreadsheetRecord[] = [];

    for (const order of orders) {
      const tier = getTicketTierById(order.ticketTierId);
      const orderHolds = holdsByOrder.get(order.orderId) || [];
      const orderTickets = ticketsByOrder.get(order.orderId) || [];
      const seatRows = new Map<
        string,
        {
          hold?: AdminTicketSpreadsheetHoldRecord;
          ticket?: AdminTicketSpreadsheetTicketRecord;
        }
      >();

      for (const hold of orderHolds) {
        seatRows.set(`seat:${normalizeSeatLabel(hold.seatLabel)}`, { hold });
      }

      for (const ticket of orderTickets) {
        const keySeatLabel = ticket.seatLabel || ticket.originalSeatLabel;
        const key = keySeatLabel ? `seat:${normalizeSeatLabel(keySeatLabel)}` : `ticket:${ticket.ticketId}`;
        const existing = seatRows.get(key) || {};

        existing.ticket = ticket;
        seatRows.set(key, existing);
      }

      if (seatRows.size < 1) {
        rows.push({
          amountTotal: order.amountTotal,
          checkoutFlow: order.checkoutFlow,
          checkoutSessionId: order.checkoutSessionId,
          currency: order.currency,
          customerReceiptEmailSentAt: order.customerReceiptEmailSentAt,
          customerReceiptEmailStatus: order.customerReceiptEmailStatus,
          holdCreatedAt: null,
          holdExpiresAt: null,
          holdId: null,
          holdStatus: null,
          orderCreatedAt: order.createdAt,
          orderId: order.orderId,
          orderStatus: order.orderStatus,
          orderUpdatedAt: order.updatedAt,
          originalSeatLabel: null,
          paidAt: order.paidAt,
          purchaserEmail: order.purchaserEmail,
          purchaserName: order.purchaserName,
          purchaserPhone: order.purchaserPhone,
          rowType: "order",
          seatAssignmentMode: order.seatAssignmentMode,
          seatLabel: null,
          ticketCreatedAt: null,
          ticketId: null,
          ticketIndex: null,
          ticketQuantity: order.ticketQuantity,
          ticketStatus: null,
          ticketTierId: order.ticketTierId,
          ticketUpdatedAt: null,
          tierName: tier?.name ?? order.ticketTierId,
        });
        continue;
      }

      const mergedRows = Array.from(seatRows.values()).sort((left, right) => {
        const leftSeatLabel = left.ticket?.seatLabel || left.ticket?.originalSeatLabel || left.hold?.seatLabel || "";
        const rightSeatLabel =
          right.ticket?.seatLabel || right.ticket?.originalSeatLabel || right.hold?.seatLabel || "";

        return leftSeatLabel.localeCompare(rightSeatLabel, undefined, { numeric: true, sensitivity: "base" });
      });

      for (const seatRow of mergedRows) {
        const seatLabel =
          seatRow.ticket?.seatLabel || seatRow.ticket?.originalSeatLabel || seatRow.hold?.seatLabel || null;
        const rowType = seatRow.ticket
          ? seatRow.hold
            ? "ticket+hold"
            : "ticket"
          : "hold";

        rows.push({
          amountTotal: order.amountTotal,
          checkoutFlow: order.checkoutFlow,
          checkoutSessionId: order.checkoutSessionId,
          currency: order.currency,
          customerReceiptEmailSentAt: order.customerReceiptEmailSentAt,
          customerReceiptEmailStatus: order.customerReceiptEmailStatus,
          holdCreatedAt: seatRow.hold?.createdAt ?? null,
          holdExpiresAt: seatRow.hold?.expiresAt ?? null,
          holdId: seatRow.hold?.holdId ?? null,
          holdStatus: seatRow.hold?.holdStatus ?? null,
          orderCreatedAt: order.createdAt,
          orderId: order.orderId,
          orderStatus: order.orderStatus,
          orderUpdatedAt: order.updatedAt,
          originalSeatLabel: seatRow.ticket?.originalSeatLabel ?? null,
          paidAt: order.paidAt,
          purchaserEmail: order.purchaserEmail,
          purchaserName: order.purchaserName,
          purchaserPhone: order.purchaserPhone,
          rowType,
          seatAssignmentMode: order.seatAssignmentMode,
          seatLabel,
          ticketCreatedAt: seatRow.ticket?.createdAt ?? null,
          ticketId: seatRow.ticket?.ticketId ?? null,
          ticketIndex: seatRow.ticket?.ticketIndex ?? null,
          ticketQuantity: order.ticketQuantity,
          ticketStatus: seatRow.ticket?.ticketStatus ?? null,
          ticketTierId: order.ticketTierId,
          ticketUpdatedAt: seatRow.ticket?.updatedAt ?? null,
          tierName: tier?.name ?? order.ticketTierId,
        });
      }
    }

    return rows;
  });
}

export async function createReservedSeatCheckoutReservation({
  seatLabels,
  smsConsentOptIn,
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
          sms_consent_opt_in,
          sms_consent_source,
          sms_consent_updated_at,
          ticket_tier_id,
          ticket_quantity,
          order_status,
          seat_assignment_mode
        )
        values (
          ${orderId},
          ${eventDetails.slug},
          'reserved_seat',
          ${smsConsentOptIn},
          ${smsConsentOptIn ? "ticket_checkout" : null},
          ${smsConsentOptIn ? new Date() : null},
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
        ticket_tickets.ticket_status as "ticketStatus",
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

export async function getTicketOrderById(orderId: string) {
  return withStore(async (sql) => {
    return getTicketOrderByIdUsingSql(sql, orderId);
  });
}

export async function updateTicketOrderPurchaserEmail(orderId: string, purchaserEmail: string) {
  return withStore(async (sql) => {
    const normalizedPurchaserEmail = purchaserEmail.trim();

    const updatedOrders = await sql<TicketOrderRecord[]>`
      update ticket_orders
      set purchaser_email = ${normalizedPurchaserEmail},
          updated_at = now()
      where id = ${orderId}
      returning
        ticket_orders.amount_total as "amountTotal",
        ticket_orders.admin_sale_email_locked_at as "adminSaleEmailLockedAt",
        ticket_orders.admin_sale_email_sent_at as "adminSaleEmailSentAt",
        coalesce(ticket_orders.admin_sale_email_status, 'pending') as "adminSaleEmailStatus",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        ticket_orders.created_at as "createdAt",
        ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
        ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
        coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
        ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
        ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
        coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
        coalesce(ticket_orders.currency, 'usd') as currency,
        ticket_orders.event_slug as "eventSlug",
        ticket_orders.id,
        ticket_orders.order_status as "orderStatus",
        ticket_orders.paid_at as "paidAt",
        coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
        coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
        coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
        coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
        ticket_orders.ticket_quantity as "ticketQuantity",
        ticket_orders.ticket_tier_id as "ticketTierId",
        ticket_orders.updated_at as "updatedAt"
    `;

    const order = updatedOrders[0];

    if (!order) {
      return null;
    }

    const tickets = await sql<TicketRecord[]>`
      select
        ticket_tickets.id,
        ticket_tickets.order_id as "orderId",
        ticket_tickets.original_seat_label as "originalSeatLabel",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_tickets.ticket_status as "ticketStatus"
      from ticket_tickets
      where ticket_tickets.order_id = ${orderId}
      order by ticket_tickets.ticket_index asc
    `;

    return {
      ...order,
      tickets,
    };
  });
}

export async function updateTicketOrderPurchaserPhone(orderId: string, purchaserPhone: string) {
  return withStore(async (sql) => {
    const normalizedPurchaserPhone = purchaserPhone.trim();

    const updatedOrders = await sql<TicketOrderRecord[]>`
      update ticket_orders
      set purchaser_phone = ${normalizedPurchaserPhone},
          updated_at = now()
      where id = ${orderId}
      returning
        ticket_orders.amount_total as "amountTotal",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        ticket_orders.created_at as "createdAt",
        ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
        ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
        coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
        ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
        ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
        coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
        coalesce(ticket_orders.currency, 'usd') as currency,
        ticket_orders.event_slug as "eventSlug",
        ticket_orders.id,
        ticket_orders.order_status as "orderStatus",
        ticket_orders.paid_at as "paidAt",
        coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
        coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
        coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
        coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
        ticket_orders.ticket_quantity as "ticketQuantity",
        ticket_orders.ticket_tier_id as "ticketTierId",
        ticket_orders.updated_at as "updatedAt"
    `;

    const order = updatedOrders[0];

    if (!order) {
      return null;
    }

    const tickets = await sql<TicketRecord[]>`
      select
        ticket_tickets.id,
        ticket_tickets.order_id as "orderId",
        ticket_tickets.original_seat_label as "originalSeatLabel",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_tickets.ticket_status as "ticketStatus"
      from ticket_tickets
      where ticket_tickets.order_id = ${orderId}
      order by ticket_tickets.ticket_index asc
    `;

    return {
      ...order,
      tickets,
    };
  });
}

async function getTicketOrderByIdUsingSql(sql: Sql | TransactionSql, orderId: string) {
  const orders = await getTicketOrdersByIdsUsingSql(sql, [orderId]);
  return orders[0] || null;
}

async function getTicketOrdersByIdsUsingSql(sql: Sql | TransactionSql, orderIds: string[]) {
  if (orderIds.length < 1) {
    return [];
  }

  const orders = await sql<TicketOrderRecord[]>`
      select
        ticket_orders.amount_total as "amountTotal",
        ticket_orders.admin_sale_email_locked_at as "adminSaleEmailLockedAt",
        ticket_orders.admin_sale_email_sent_at as "adminSaleEmailSentAt",
        coalesce(ticket_orders.admin_sale_email_status, 'pending') as "adminSaleEmailStatus",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        ticket_orders.created_at as "createdAt",
        ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
        ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
        coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
        ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
        ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
        coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
        coalesce(ticket_orders.currency, 'usd') as currency,
        ticket_orders.event_slug as "eventSlug",
        ticket_orders.id,
        ticket_orders.order_status as "orderStatus",
        ticket_orders.paid_at as "paidAt",
        coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
        coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
        coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
        coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
        ticket_orders.ticket_quantity as "ticketQuantity",
        ticket_orders.ticket_tier_id as "ticketTierId",
        ticket_orders.updated_at as "updatedAt"
      from ticket_orders
      where ticket_orders.id in ${sql(orderIds)}
  `;

  const tickets = await sql<TicketRecord[]>`
      select
        ticket_tickets.id,
        ticket_tickets.order_id as "orderId",
        ticket_tickets.original_seat_label as "originalSeatLabel",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_tickets.ticket_status as "ticketStatus"
      from ticket_tickets
      where ticket_tickets.order_id in ${sql(orderIds)}
      order by ticket_tickets.order_id asc, ticket_tickets.ticket_index asc
  `;

  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const ticketsByOrderId = new Map<string, TicketRecord[]>();

  for (const ticket of tickets) {
    const existingTickets = ticketsByOrderId.get(ticket.orderId);

    if (existingTickets) {
      existingTickets.push(ticket);
      continue;
    }

    ticketsByOrderId.set(ticket.orderId, [ticket]);
  }

  return orderIds
    .map((orderId) => {
      const order = orderMap.get(orderId);

      if (!order) {
        return null;
      }

      return {
        ...order,
        tickets: ticketsByOrderId.get(order.id) || [],
      };
    })
    .filter((order) => order !== null);
}

export async function getTicketOrderByCheckoutSessionId(checkoutSessionId: string) {
  return withStore(async (sql) => {
    const orders = await sql<TicketOrderRecord[]>`
      select
        ticket_orders.amount_total as "amountTotal",
        ticket_orders.admin_sale_email_locked_at as "adminSaleEmailLockedAt",
        ticket_orders.admin_sale_email_sent_at as "adminSaleEmailSentAt",
        coalesce(ticket_orders.admin_sale_email_status, 'pending') as "adminSaleEmailStatus",
        ticket_orders.checkout_flow as "checkoutFlow",
        ticket_orders.checkout_session_id as "checkoutSessionId",
        ticket_orders.created_at as "createdAt",
        ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
        ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
        coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
        ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
        ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
        coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
        coalesce(ticket_orders.currency, 'usd') as currency,
        ticket_orders.event_slug as "eventSlug",
        ticket_orders.id,
        ticket_orders.order_status as "orderStatus",
        ticket_orders.paid_at as "paidAt",
        coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
        coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
        coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
        coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
        ticket_orders.ticket_quantity as "ticketQuantity",
        ticket_orders.ticket_tier_id as "ticketTierId",
        ticket_orders.updated_at as "updatedAt"
      from ticket_orders
      where ticket_orders.checkout_session_id = ${checkoutSessionId}
      limit 1
    `;
    const order = orders[0];

    if (!order) {
      return null;
    }

    const tickets = await sql<TicketRecord[]>`
      select
        ticket_tickets.id,
        ticket_tickets.order_id as "orderId",
        ticket_tickets.original_seat_label as "originalSeatLabel",
        ticket_tickets.seat_label as "seatLabel",
        ticket_tickets.ticket_index as "ticketIndex",
        ticket_tickets.ticket_status as "ticketStatus"
      from ticket_tickets
      where ticket_tickets.order_id = ${order.id}
      order by ticket_tickets.ticket_index asc
    `;

    return {
      ...order,
      tickets,
    };
  });
}

export async function findPaidTicketOrders(searchTerm: string, limit = 10) {
  return withStore(async (sql) => {
    const normalizedSearchTerm = searchTerm.trim();

    if (!normalizedSearchTerm) {
      throw new TicketingStoreError("Enter a seat, order, checkout session, email, or phone number.", 400);
    }

    const normalizedSearchUpper = normalizedSearchTerm.toUpperCase();
    const normalizedSearchLower = normalizedSearchTerm.toLowerCase();
    const phoneDigits = normalizedSearchTerm.replace(/\D/g, "");
    const clampedLimit = Math.max(1, Math.min(Math.round(limit), 25));

    const matchedOrders = await sql<{ id: string }[]>`
      select ticket_orders.id
      from ticket_orders
      left join ticket_tickets on ticket_tickets.order_id = ticket_orders.id
      where ticket_orders.event_slug = ${eventDetails.slug}
        and ticket_orders.order_status = 'paid'
        and (
          upper(coalesce(ticket_tickets.seat_label, '')) = ${normalizedSearchUpper}
          or upper(coalesce(ticket_tickets.original_seat_label, '')) = ${normalizedSearchUpper}
          or ticket_orders.id::text = ${normalizedSearchTerm}
          or coalesce(ticket_orders.checkout_session_id, '') = ${normalizedSearchTerm}
          or lower(coalesce(ticket_orders.purchaser_email, '')) = ${normalizedSearchLower}
          or lower(coalesce(ticket_orders.purchaser_name, '')) like ${`%${normalizedSearchLower}%`}
          or (
            ${phoneDigits.length >= 7}
            and regexp_replace(coalesce(ticket_orders.purchaser_phone, ''), '[^0-9]', '', 'g') like ${`%${phoneDigits}`}
          )
        )
      group by ticket_orders.id, coalesce(ticket_orders.paid_at, ticket_orders.updated_at, ticket_orders.created_at)
      order by coalesce(ticket_orders.paid_at, ticket_orders.updated_at, ticket_orders.created_at) desc
      limit ${clampedLimit}
    `;

    return getTicketOrdersByIdsUsingSql(
      sql,
      matchedOrders.map((order) => order.id),
    );
  });
}

export async function listRecentPaidTicketOrders(limit = 10) {
  return withStore(async (sql) => {
    const clampedLimit = Math.max(1, Math.min(Math.round(limit), 25));
    const recentOrders = await sql<{ id: string }[]>`
      select ticket_orders.id
      from ticket_orders
      where ticket_orders.event_slug = ${eventDetails.slug}
        and ticket_orders.order_status = 'paid'
      order by coalesce(ticket_orders.paid_at, ticket_orders.updated_at, ticket_orders.created_at) desc
      limit ${clampedLimit}
    `;

    return getTicketOrdersByIdsUsingSql(
      sql,
      recentOrders.map((order) => order.id),
    );
  });
}

export async function claimCustomerReceiptEmailSend(checkoutSessionId: string) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      const orders = await tx<TicketOrderRecord[]>`
        select
          ticket_orders.amount_total as "amountTotal",
          ticket_orders.admin_sale_email_locked_at as "adminSaleEmailLockedAt",
          ticket_orders.admin_sale_email_sent_at as "adminSaleEmailSentAt",
          coalesce(ticket_orders.admin_sale_email_status, 'pending') as "adminSaleEmailStatus",
          ticket_orders.checkout_flow as "checkoutFlow",
          ticket_orders.checkout_session_id as "checkoutSessionId",
          ticket_orders.created_at as "createdAt",
          ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
          ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
          coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
          ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
          ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
          coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
          coalesce(ticket_orders.currency, 'usd') as currency,
          ticket_orders.event_slug as "eventSlug",
          ticket_orders.id,
          ticket_orders.order_status as "orderStatus",
          ticket_orders.paid_at as "paidAt",
          coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
          coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
          coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
          coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
          coalesce(ticket_orders.sms_consent_opt_in, false) as "smsConsentOptIn",
          ticket_orders.ticket_quantity as "ticketQuantity",
          ticket_orders.ticket_tier_id as "ticketTierId",
          ticket_orders.updated_at as "updatedAt"
        from ticket_orders
        where ticket_orders.checkout_session_id = ${checkoutSessionId}
        limit 1
        for update
      `;
      const order = orders[0];

      if (!order) {
        return null;
      }

      if (order.orderStatus !== "paid" || order.customerReceiptEmailSentAt) {
        return null;
      }

      const lockedAt = order.customerReceiptEmailLockedAt?.getTime() || 0;
      const lockIsFresh = lockedAt > Date.now() - 15 * 60_000;

      if (order.customerReceiptEmailStatus === "sending" && lockIsFresh) {
        return null;
      }

      await tx`
        update ticket_orders
        set customer_receipt_email_status = 'sending',
            customer_receipt_email_locked_at = now(),
            updated_at = now()
        where id = ${order.id}
      `;

      const tickets = await tx<TicketRecord[]>`
        select
          ticket_tickets.id,
          ticket_tickets.order_id as "orderId",
          ticket_tickets.original_seat_label as "originalSeatLabel",
          ticket_tickets.seat_label as "seatLabel",
          ticket_tickets.ticket_index as "ticketIndex",
          ticket_tickets.ticket_status as "ticketStatus"
        from ticket_tickets
        where ticket_tickets.order_id = ${order.id}
        order by ticket_tickets.ticket_index asc
      `;

      return {
        ...order,
        tickets,
      };
    }),
  );
}

export async function markCustomerReceiptEmailSent(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set customer_receipt_email_status = 'sent',
          customer_receipt_email_sent_at = now(),
          customer_receipt_email_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
  });
}

export async function markCustomerReceiptEmailFailed(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set customer_receipt_email_status = 'failed',
          customer_receipt_email_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
  });
}

export async function claimAdminSaleNotificationEmailSend(checkoutSessionId: string) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      const orders = await tx<TicketOrderRecord[]>`
        select
          ticket_orders.amount_total as "amountTotal",
          ticket_orders.admin_sale_email_locked_at as "adminSaleEmailLockedAt",
          ticket_orders.admin_sale_email_sent_at as "adminSaleEmailSentAt",
          coalesce(ticket_orders.admin_sale_email_status, 'pending') as "adminSaleEmailStatus",
          ticket_orders.checkout_flow as "checkoutFlow",
          ticket_orders.checkout_session_id as "checkoutSessionId",
          ticket_orders.created_at as "createdAt",
          ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
          ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
          coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
          ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
          ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
          coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
          coalesce(ticket_orders.currency, 'usd') as currency,
          ticket_orders.event_slug as "eventSlug",
          ticket_orders.id,
          ticket_orders.order_status as "orderStatus",
          ticket_orders.paid_at as "paidAt",
          coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
          coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
          coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
          coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
          ticket_orders.ticket_quantity as "ticketQuantity",
          ticket_orders.ticket_tier_id as "ticketTierId",
          ticket_orders.updated_at as "updatedAt"
        from ticket_orders
        where ticket_orders.checkout_session_id = ${checkoutSessionId}
        limit 1
        for update
      `;
      const order = orders[0];

      if (!order) {
        return null;
      }

      if (order.orderStatus !== "paid" || order.adminSaleEmailSentAt) {
        return null;
      }

      const lockedAt = order.adminSaleEmailLockedAt?.getTime() || 0;
      const lockIsFresh = lockedAt > Date.now() - 15 * 60_000;

      if (order.adminSaleEmailStatus === "sending" && lockIsFresh) {
        return null;
      }

      await tx`
        update ticket_orders
        set admin_sale_email_status = 'sending',
            admin_sale_email_locked_at = now(),
            updated_at = now()
        where id = ${order.id}
      `;

      const tickets = await tx<TicketRecord[]>`
        select
          ticket_tickets.id,
          ticket_tickets.order_id as "orderId",
          ticket_tickets.original_seat_label as "originalSeatLabel",
          ticket_tickets.seat_label as "seatLabel",
          ticket_tickets.ticket_index as "ticketIndex",
          ticket_tickets.ticket_status as "ticketStatus"
        from ticket_tickets
        where ticket_tickets.order_id = ${order.id}
        order by ticket_tickets.ticket_index asc
      `;

      return {
        ...order,
        tickets,
      };
    }),
  );
}

export async function markAdminSaleNotificationEmailSent(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set admin_sale_email_status = 'sent',
          admin_sale_email_sent_at = now(),
          admin_sale_email_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
  });
}

export async function markAdminSaleNotificationEmailFailed(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set admin_sale_email_status = 'failed',
          admin_sale_email_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
  });
}

export async function claimCustomerReceiptSmsSend(checkoutSessionId: string) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      const orders = await tx<TicketOrderRecord[]>`
        select
          ticket_orders.amount_total as "amountTotal",
          ticket_orders.checkout_flow as "checkoutFlow",
          ticket_orders.checkout_session_id as "checkoutSessionId",
          ticket_orders.created_at as "createdAt",
          ticket_orders.customer_receipt_email_locked_at as "customerReceiptEmailLockedAt",
          ticket_orders.customer_receipt_email_sent_at as "customerReceiptEmailSentAt",
          coalesce(ticket_orders.customer_receipt_email_status, 'pending') as "customerReceiptEmailStatus",
          ticket_orders.customer_receipt_sms_locked_at as "customerReceiptSmsLockedAt",
          ticket_orders.customer_receipt_sms_sent_at as "customerReceiptSmsSentAt",
          coalesce(ticket_orders.customer_receipt_sms_status, 'pending') as "customerReceiptSmsStatus",
          coalesce(ticket_orders.currency, 'usd') as currency,
          ticket_orders.event_slug as "eventSlug",
          ticket_orders.id,
          ticket_orders.order_status as "orderStatus",
          ticket_orders.paid_at as "paidAt",
          coalesce(ticket_orders.purchaser_email, '') as "purchaserEmail",
          coalesce(ticket_orders.purchaser_name, '') as "purchaserName",
          coalesce(ticket_orders.purchaser_phone, '') as "purchaserPhone",
          coalesce(ticket_orders.seat_assignment_mode, 'reserved') as "seatAssignmentMode",
          ticket_orders.ticket_quantity as "ticketQuantity",
          ticket_orders.ticket_tier_id as "ticketTierId",
          ticket_orders.updated_at as "updatedAt"
        from ticket_orders
        where ticket_orders.checkout_session_id = ${checkoutSessionId}
        limit 1
        for update
      `;
      const order = orders[0];

      if (!order) {
        return null;
      }

      if (!order.smsConsentOptIn) {
        if (order.customerReceiptSmsStatus !== "skipped") {
          await tx`
            update ticket_orders
            set customer_receipt_sms_status = 'skipped',
                customer_receipt_sms_locked_at = null,
                updated_at = now()
            where id = ${order.id}
          `;
        }

        return null;
      }

      if (
        order.orderStatus !== "paid" ||
        order.customerReceiptSmsSentAt ||
        order.customerReceiptSmsStatus === "skipped"
      ) {
        return null;
      }

      const lockedAt = order.customerReceiptSmsLockedAt?.getTime() || 0;
      const lockIsFresh = lockedAt > Date.now() - 15 * 60_000;

      if (order.customerReceiptSmsStatus === "sending" && lockIsFresh) {
        return null;
      }

      await tx`
        update ticket_orders
        set customer_receipt_sms_status = 'sending',
            customer_receipt_sms_locked_at = now(),
            updated_at = now()
        where id = ${order.id}
      `;

      const tickets = await tx<TicketRecord[]>`
        select
          ticket_tickets.id,
          ticket_tickets.order_id as "orderId",
          ticket_tickets.original_seat_label as "originalSeatLabel",
          ticket_tickets.seat_label as "seatLabel",
          ticket_tickets.ticket_index as "ticketIndex",
          ticket_tickets.ticket_status as "ticketStatus"
        from ticket_tickets
        where ticket_tickets.order_id = ${order.id}
        order by ticket_tickets.ticket_index asc
      `;

      return {
        ...order,
        tickets,
      };
    }),
  );
}

export async function markCustomerReceiptSmsSent(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set customer_receipt_sms_status = 'sent',
          customer_receipt_sms_sent_at = now(),
          customer_receipt_sms_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
  });
}

export async function markCustomerReceiptSmsFailed(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set customer_receipt_sms_status = 'failed',
          customer_receipt_sms_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
  });
}

export async function markCustomerReceiptSmsSkipped(orderId: string) {
  return withStore(async (sql) => {
    await sql`
      update ticket_orders
      set customer_receipt_sms_status = 'skipped',
          customer_receipt_sms_locked_at = null,
          updated_at = now()
      where id = ${orderId}
    `;
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
            purchaser_name = ${getStripePurchaserName(session)},
            purchaser_email = ${getStripePurchaserEmail(session)},
            purchaser_phone = ${getStripePurchaserPhone(session)},
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

export async function releasePaidSeatsForAdmin({
  actorLabel,
  notes,
  seatLabels,
}: ReleasePaidSeatsParams) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      await releaseExpiredSeatHolds(tx);

      const normalizedSeatLabels = normalizeSeatLabels(seatLabels);

      if (normalizedSeatLabels.length < 1) {
        throw new TicketingStoreError("Please provide at least one paid seat to reopen.", 400);
      }

      const seatEntries = normalizedSeatLabels.map((seatLabel) => ({
        seatLabel,
        tierId: getTierIdForSeatLabel(seatLabel),
      }));
      const invalidSeat = seatEntries.find((entry) => !entry.tierId);

      if (invalidSeat) {
        throw new TicketingStoreError(`Seat ${invalidSeat.seatLabel} is not a valid seat label.`, 400);
      }

      const paidTickets = await tx<
        {
          hold_id: string;
          order_id: string;
          seat_label: string;
          ticket_id: string;
        }[]
      >`
        select
          ticket_seat_holds.id as hold_id,
          ticket_seat_holds.order_id as order_id,
          ticket_seat_holds.seat_label as seat_label,
          ticket_tickets.id as ticket_id
        from ticket_seat_holds
        inner join ticket_orders on ticket_orders.id = ticket_seat_holds.order_id
        inner join ticket_tickets
          on ticket_tickets.order_id = ticket_seat_holds.order_id
         and ticket_tickets.seat_label = ticket_seat_holds.seat_label
         and ticket_tickets.ticket_status = 'active'
        where ticket_seat_holds.event_slug = ${eventDetails.slug}
          and ticket_seat_holds.seat_label in ${tx(normalizedSeatLabels)}
          and ticket_seat_holds.status = 'converted'
          and ticket_orders.order_status = 'paid'
        for update
      `;

      const paidSeatLabels = paidTickets.map((ticket) => ticket.seat_label.trim().toUpperCase());
      const paidSeatSet = new Set(paidSeatLabels);
      const notPaidSeatLabels = normalizedSeatLabels.filter((seatLabel) => !paidSeatSet.has(seatLabel));

      if (paidTickets.length > 0) {
        await tx`
          update ticket_seat_holds
          set status = 'released',
              updated_at = now()
          where id in ${tx(paidTickets.map((ticket) => ticket.hold_id))}
        `;

        await tx`
          update ticket_tickets
          set ticket_status = 'canceled',
              updated_at = now()
          where id in ${tx(paidTickets.map((ticket) => ticket.ticket_id))}
        `;

        await tx`
          update ticket_orders
          set updated_at = now()
          where id in ${tx(Array.from(new Set(paidTickets.map((ticket) => ticket.order_id))))}
        `;

        for (const ticket of paidTickets) {
          await tx`
            insert into ticket_admin_audit (
              id,
              actor_label,
              action_type,
              order_id,
              ticket_id,
              seat_label_from,
              notes
            )
            values (
              ${randomUUID()},
              ${actorLabel},
              'paid_seat_released_admin',
              ${ticket.order_id},
              ${ticket.ticket_id},
              ${ticket.seat_label.trim().toUpperCase()},
              ${notes?.trim() || ""}
            )
          `;
        }
      }

      return {
        notPaidSeatLabels,
        releasedSeatLabels: paidSeatLabels,
      };
    }),
  );
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

export async function blockSeatsForAdmin({ actorLabel, notes, seatLabels }: BlockSeatsParams) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      await releaseExpiredSeatHolds(tx);

      const normalizedSeatLabels = normalizeSeatLabels(seatLabels);

      if (normalizedSeatLabels.length < 1) {
        throw new TicketingStoreError("Please provide at least one seat to block.", 400);
      }

      const seatEntries = normalizedSeatLabels.map((seatLabel) => ({
        seatLabel,
        tierId: getTierIdForSeatLabel(seatLabel),
      }));
      const invalidSeat = seatEntries.find((entry) => !entry.tierId);

      if (invalidSeat) {
        throw new TicketingStoreError(`Seat ${invalidSeat.seatLabel} is not a valid seat label.`, 400);
      }

      const existingHolds = await tx<
        {
          order_id: string;
          seat_label: string;
          status: SeatHoldStatus;
        }[]
      >`
        select order_id, seat_label, status
        from ticket_seat_holds
        where event_slug = ${eventDetails.slug}
          and seat_label in ${tx(normalizedSeatLabels)}
          and (
            status in ('blocked', 'converted')
            or (status = 'held' and expires_at > now())
          )
        for update
      `;

      const alreadyBlockedSeatLabels = existingHolds
        .filter((hold) => hold.status === "blocked")
        .map((hold) => hold.seat_label.trim().toUpperCase());
      const conflictingSeat = existingHolds.find((hold) => hold.status !== "blocked");

      if (conflictingSeat) {
        throw new TicketingStoreError(
          `Seat ${conflictingSeat.seat_label.trim().toUpperCase()} is already assigned or in an active checkout hold.`,
          409,
        );
      }

      const alreadyBlockedSet = new Set(alreadyBlockedSeatLabels);
      const newlyBlockedSeatEntries = seatEntries.filter(
        (entry): entry is { seatLabel: string; tierId: TicketTierId } =>
          Boolean(entry.tierId) && !alreadyBlockedSet.has(entry.seatLabel),
      );

      for (const entry of newlyBlockedSeatEntries) {
        const orderId = randomUUID();

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
            ${entry.tierId},
            1,
            'pending',
            'blocked'
          )
        `;

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
            ${entry.seatLabel},
            ${entry.tierId},
            'blocked',
            now()
          )
        `;

        await tx`
          insert into ticket_admin_audit (
            id,
            actor_label,
            action_type,
            order_id,
            seat_label_to,
            notes
          )
          values (
            ${randomUUID()},
            ${actorLabel},
            'seat_blocked',
            ${orderId},
            ${entry.seatLabel},
            ${notes?.trim() || ""}
          )
        `;
      }

      return {
        alreadyBlockedSeatLabels,
        blockedSeatLabels: newlyBlockedSeatEntries.map((entry) => entry.seatLabel),
      };
    }),
  );
}

export async function issueBlockedSeatsForAdmin({
  actorLabel,
  notes,
  purchaserEmail,
  purchaserName,
  purchaserPhone,
  seatLabels,
}: IssueAdminTicketsParams) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      const normalizedSeatLabels = normalizeSeatLabels(seatLabels);
      const normalizedPurchaserName = purchaserName.trim();
      const normalizedPurchaserEmail = purchaserEmail?.trim() || "";
      const normalizedPurchaserPhone = purchaserPhone?.trim() || "";

      if (!normalizedPurchaserName) {
        throw new TicketingStoreError("Please provide the recipient name for these tickets.", 400);
      }

      if (normalizedSeatLabels.length < 1) {
        throw new TicketingStoreError("Please provide at least one blocked seat to issue.", 400);
      }

      type SponsorBlockHoldRow = {
        id: string;
        hold_status: SeatHoldStatus;
        order_id: string;
        order_status: OrderStatus;
        seat_assignment_mode: string;
        seat_label: string;
        ticket_tier_id: TicketTierId;
        hold_updated_at: Date;
      };

      const blockedHolds = await tx<SponsorBlockHoldRow[]>`
        select
          ticket_seat_holds.id,
          ticket_seat_holds.status as hold_status,
          ticket_seat_holds.order_id,
          ticket_orders.order_status as order_status,
          coalesce(ticket_orders.seat_assignment_mode, 'reserved') as seat_assignment_mode,
          ticket_seat_holds.seat_label,
          ticket_seat_holds.ticket_tier_id,
          ticket_seat_holds.updated_at as hold_updated_at
        from ticket_seat_holds
        inner join ticket_orders on ticket_orders.id = ticket_seat_holds.order_id
        where ticket_seat_holds.event_slug = ${eventDetails.slug}
          and ticket_seat_holds.seat_label in ${tx(normalizedSeatLabels)}
        order by ticket_seat_holds.updated_at desc, ticket_seat_holds.created_at desc
        for update
      `;

      const unavailableSeatLabels = await getUnavailableSeatLabelsForUpdate(tx);
      const selectedSourceHolds: SponsorBlockHoldRow[] = [];
      const existingIssuedHolds: SponsorBlockHoldRow[] = [];
      const missingSeatReasons: string[] = [];

      for (const seatLabel of normalizedSeatLabels) {
        const matchingHolds = blockedHolds.filter(
          (hold) => hold.seat_label.trim().toUpperCase() === seatLabel,
        );
        const activeSponsorHold = matchingHolds.find(
          (hold) =>
            hold.order_status === "pending" &&
            hold.seat_assignment_mode === "blocked" &&
            (hold.hold_status === "blocked" || hold.hold_status === "converted"),
        );

        if (activeSponsorHold) {
          selectedSourceHolds.push(activeSponsorHold);
          continue;
        }

        const reusableReleasedSponsorHold = matchingHolds.find(
          (hold) =>
            hold.order_status === "canceled" &&
            hold.seat_assignment_mode === "blocked" &&
            hold.hold_status === "released",
        );

        if (reusableReleasedSponsorHold && !unavailableSeatLabels.has(seatLabel)) {
          selectedSourceHolds.push(reusableReleasedSponsorHold);
          continue;
        }

        const existingAdminIssuedHold = matchingHolds.find(
          (hold) =>
            hold.order_status === "paid" &&
            hold.seat_assignment_mode === "admin_issued" &&
            hold.hold_status === "converted",
        );

        if (existingAdminIssuedHold) {
          existingIssuedHolds.push(existingAdminIssuedHold);
          continue;
        }

        const conflictingHold = matchingHolds.find(
          (hold) =>
            hold.hold_status === "converted" ||
            hold.hold_status === "blocked" ||
            (hold.hold_status === "held" && hold.order_status === "pending"),
          );

        if (conflictingHold) {
          missingSeatReasons.push(
            `${seatLabel} (${conflictingHold.hold_status}, ${conflictingHold.order_status}, ${conflictingHold.seat_assignment_mode})`,
          );
          continue;
        }

        if (reusableReleasedSponsorHold && unavailableSeatLabels.has(seatLabel)) {
          missingSeatReasons.push(
            `${seatLabel} (released, canceled, blocked; seat currently unavailable elsewhere)`,
          );
          continue;
        }

        const matchingHold = matchingHolds[0];
        if (matchingHold) {
          missingSeatReasons.push(
            `${seatLabel} (${matchingHold.hold_status}, ${matchingHold.order_status}, ${matchingHold.seat_assignment_mode})`,
          );
          continue;
        }

        missingSeatReasons.push(seatLabel);
      }

      if (existingIssuedHolds.length === normalizedSeatLabels.length) {
        const existingOrderIds = Array.from(new Set(existingIssuedHolds.map((hold) => hold.order_id)));

        if (existingOrderIds.length === 1) {
          const existingOrder = await getTicketOrderByIdUsingSql(tx, existingOrderIds[0]);

          if (
            existingOrder &&
            existingOrder.orderStatus === "paid" &&
            existingOrder.seatAssignmentMode === "admin_issued" &&
            existingOrder.tickets.length > 0
          ) {
            return {
              checkoutSessionId: existingOrder.checkoutSessionId,
              issuedSeatLabels: existingOrder.tickets.map((ticket) => ticket.seatLabel),
              message: "These seats were already issued. Open or resend the existing printable passes below.",
              orderId: existingOrder.id,
              purchaserEmail: existingOrder.purchaserEmail,
              purchaserName: existingOrder.purchaserName,
              purchaserPhone: existingOrder.purchaserPhone,
              ticketTierId: existingOrder.ticketTierId,
            };
          }
        }
      }

      if (missingSeatReasons.length > 0) {
        throw new TicketingStoreError(
          `These seats are not currently in an issuable sponsor-block status: ${missingSeatReasons.join(", ")}.`,
          409,
        );
      }

      const tierIds = Array.from(new Set(selectedSourceHolds.map((hold) => hold.ticket_tier_id)));

      if (tierIds.length !== 1) {
        throw new TicketingStoreError(
          "Issue one pricing tier at a time when generating sponsor or comp tickets.",
          409,
        );
      }

      const ticketTierId = tierIds[0];
      const tier = getTicketTierById(ticketTierId);
      const orderId = randomUUID();
      const checkoutSessionId = getAdminIssuedCheckoutSessionId(orderId);
      const ticketQuantity = normalizedSeatLabels.length;

      if (!tier) {
        throw new TicketingStoreError("Ticket tier could not be resolved for these blocked seats.", 500);
      }

      const activeIssueableBlockedHolds = selectedSourceHolds.filter(
        (hold) =>
          hold.order_status === "pending" &&
          hold.seat_assignment_mode === "blocked" &&
          (hold.hold_status === "blocked" || hold.hold_status === "converted"),
      );

      if (activeIssueableBlockedHolds.length > 0) {
        await tx`
          update ticket_seat_holds
          set status = 'released',
              updated_at = now()
          where id in ${tx(activeIssueableBlockedHolds.map((hold) => hold.id))}
        `;

        await tx`
          update ticket_orders
          set order_status = 'canceled',
              updated_at = now()
          where id in ${tx(activeIssueableBlockedHolds.map((hold) => hold.order_id))}
            and order_status = 'pending'
        `;
      }

      await tx`
        insert into ticket_orders (
          id,
          checkout_session_id,
          event_slug,
          checkout_flow,
          ticket_tier_id,
          ticket_quantity,
          currency,
          amount_total,
          purchaser_name,
          purchaser_email,
          purchaser_phone,
          order_status,
          seat_assignment_mode,
          paid_at
        )
        values (
          ${orderId},
          ${checkoutSessionId},
          ${eventDetails.slug},
          'reserved_seat',
          ${ticketTierId},
          ${ticketQuantity},
          'usd',
          ${tier.priceCents * ticketQuantity},
          ${normalizedPurchaserName},
          ${normalizedPurchaserEmail},
          ${normalizedPurchaserPhone},
          'paid',
          'admin_issued',
          now()
        )
      `;

      for (const [index, seatLabel] of normalizedSeatLabels.entries()) {
        const ticketIndex = index + 1;

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
            ${orderId},
            ${checkoutSessionId},
            ${eventDetails.slug},
            ${seatLabel},
            ${ticketTierId},
            'converted',
            now()
          )
        `;

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

        await tx`
          insert into ticket_admin_audit (
            id,
            actor_label,
            action_type,
            order_id,
            seat_label_to,
            notes
          )
          values (
            ${randomUUID()},
            ${actorLabel},
            'ticket_issued_admin',
            ${orderId},
            ${seatLabel},
            ${notes?.trim() || ""}
          )
        `;
      }

      return {
        checkoutSessionId,
        issuedSeatLabels: normalizedSeatLabels,
        orderId,
        purchaserEmail: normalizedPurchaserEmail,
        purchaserName: normalizedPurchaserName,
        purchaserPhone: normalizedPurchaserPhone,
        ticketTierId,
      };
    }),
  );
}

export async function unblockSeatsForAdmin({ actorLabel, notes, seatLabels }: BlockSeatsParams) {
  return withStore(async (sql) =>
    sql.begin(async (tx) => {
      const normalizedSeatLabels = normalizeSeatLabels(seatLabels);

      if (normalizedSeatLabels.length < 1) {
        throw new TicketingStoreError("Please provide at least one seat to unblock.", 400);
      }

      const blockedHolds = await tx<
        {
          id: string;
          order_id: string;
          seat_label: string;
        }[]
      >`
        select id, order_id, seat_label
        from ticket_seat_holds
        where event_slug = ${eventDetails.slug}
          and seat_label in ${tx(normalizedSeatLabels)}
          and status = 'blocked'
        for update
      `;

      const blockedSeatLabels = blockedHolds.map((hold) => hold.seat_label.trim().toUpperCase());
      const blockedSeatSet = new Set(blockedSeatLabels);
      const notBlockedSeatLabels = normalizedSeatLabels.filter((seatLabel) => !blockedSeatSet.has(seatLabel));

      if (blockedHolds.length > 0) {
        await tx`
          update ticket_seat_holds
          set status = 'released',
              updated_at = now()
          where id in ${tx(blockedHolds.map((hold) => hold.id))}
        `;

        await tx`
          update ticket_orders
          set order_status = 'canceled',
              updated_at = now()
          where id in ${tx(blockedHolds.map((hold) => hold.order_id))}
            and order_status = 'pending'
        `;

        for (const hold of blockedHolds) {
          await tx`
            insert into ticket_admin_audit (
              id,
              actor_label,
              action_type,
              order_id,
              seat_label_from,
              notes
            )
            values (
              ${randomUUID()},
              ${actorLabel},
              'seat_unblocked',
              ${hold.order_id},
              ${hold.seat_label.trim().toUpperCase()},
              ${notes?.trim() || ""}
            )
          `;
        }
      }

      return {
        notBlockedSeatLabels,
        unblockedSeatLabels: blockedSeatLabels,
      };
    }),
  );
}
