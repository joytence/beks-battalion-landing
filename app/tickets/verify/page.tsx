import type { Metadata } from "next";
import styles from "../ticketing.module.css";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  getOrderTicketsByCheckoutSessionId,
  getTicketOrderById,
  isTicketingDatabaseConfigured,
} from "@/lib/ticketing-store";
import {
  createTicketCode,
  eventDetails,
  formatCurrency,
  formatEventDate,
  getCheckoutFlow,
  getTicketAssignmentFieldLabel,
  getTicketTierById,
  parseSignedTicketToken,
} from "@/lib/ticketing";

export const metadata: Metadata = {
  title: "Ticket Verification | Joy Stage Productions",
  description: "Verification view for Beks Battalion electronic QR tickets.",
};

type VerifyPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TicketVerifyPage({ searchParams }: VerifyPageProps) {
  const params = (await searchParams) || {};
  const ticketParam = typeof params.ticket === "string" ? params.ticket : "";
  const parsed = parseSignedTicketToken(ticketParam);
  const adminIssuedOrderId =
    parsed?.issuedOrderId?.trim() ||
    (parsed?.sessionId.startsWith("admin_issued_") ? parsed.sessionId.replace(/^admin_issued_/, "") : "");

  if (!parsed) {
    return (
      <main className={styles.page}>
        <section className={`${styles.scanCard} ${styles.scanCardInvalid}`}>
          <div className={styles.statusEyebrow}>Verification failed</div>
          <h1 className={styles.scanTitle}>Invalid Ticket</h1>
          <p className={styles.statusLead}>
            This QR code is missing, malformed, or signed with the wrong secret.
          </p>
        </section>
      </main>
    );
  }

  const tier = getTicketTierById(parsed.tierId);
  if (adminIssuedOrderId) {
    if (!isTicketingDatabaseConfigured()) {
      return (
        <main className={styles.page}>
          <section className={`${styles.scanCard} ${styles.scanCardInvalid}`}>
            <div className={styles.statusEyebrow}>Verification failed</div>
            <h1 className={styles.scanTitle}>Database Not Available</h1>
            <p className={styles.statusLead}>
              Admin-issued ticket verification requires the ticket database to be configured.
            </p>
          </section>
        </main>
      );
    }

    const order = await getTicketOrderById(adminIssuedOrderId);
    const currentTicket =
      order?.tickets.find((ticket) => ticket.ticketIndex === parsed.ticketIndex) || null;
    const currentTicketAssignment = currentTicket?.seatLabel || parsed.seatLabel;
    if (
      !order ||
      !currentTicket ||
      currentTicket.ticketStatus !== "active" ||
      !tier ||
      order.orderStatus !== "paid" ||
      order.eventSlug !== eventDetails.slug ||
      order.ticketTierId !== parsed.tierId ||
      order.ticketQuantity < parsed.ticketIndex
    ) {
      return (
        <main className={styles.page}>
          <section className={`${styles.scanCard} ${styles.scanCardInvalid}`}>
            <div className={styles.statusEyebrow}>Verification failed</div>
            <h1 className={styles.scanTitle}>Ticket Not Valid</h1>
            <p className={styles.statusLead}>
              This admin-issued ticket no longer matches the current order or seat assignment.
            </p>
          </section>
        </main>
      );
    }

    return (
      <main className={styles.page}>
        <section className={`${styles.scanCard} ${styles.scanCardValid}`}>
          <div className={styles.statusEyebrow}>Admin-issued admission confirmed</div>
          <h1 className={styles.scanTitle}>Valid Ticket</h1>
          <div className={styles.scanMeta}>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Ticket Code</span>
              <strong>{createTicketCode(order.checkoutSessionId, parsed.ticketIndex)}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Ticket Number</span>
              <strong>
                {parsed.ticketIndex} of {order.ticketQuantity}
              </strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Seat</span>
              <strong>{currentTicketAssignment}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Recipient</span>
              <strong>{order.purchaserName}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Email</span>
              <strong>{order.purchaserEmail || "Not provided"}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Tier</span>
              <strong>{tier.name}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Admission Value</span>
              <strong>{formatCurrency(order.amountTotal || 0, order.currency)}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Event</span>
              <strong>{eventDetails.name}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Date</span>
              <strong>{formatEventDate(eventDetails.dateIso)}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Venue</span>
              <strong>{eventDetails.venue}</strong>
            </div>
            <div className={styles.scanMetaItem}>
              <span className={styles.ticketLabel}>Issued Order</span>
              <strong>{order.id}</strong>
            </div>
          </div>
          <p className={styles.statusLead}>
            This QR code matches an admin-issued sponsor or comp ticket stored in the event ticket
            database.
          </p>
        </section>
      </main>
    );
  }

  if (!isStripeConfigured()) {
    return (
      <main className={styles.page}>
        <section className={`${styles.scanCard} ${styles.scanCardInvalid}`}>
          <div className={styles.statusEyebrow}>Verification failed</div>
          <h1 className={styles.scanTitle}>Stripe Not Available</h1>
          <p className={styles.statusLead}>
            Stripe must be configured to verify payment-backed QR tickets.
          </p>
        </section>
      </main>
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(parsed.sessionId);
  const checkoutFlow = getCheckoutFlow(session.metadata?.checkout_flow);
  const quantity = Number(session.metadata?.ticket_quantity || "0");
  const assignmentFieldLabel = getTicketAssignmentFieldLabel(checkoutFlow);
  const persistedTickets =
    isTicketingDatabaseConfigured() && checkoutFlow === "reserved_seat"
      ? await getOrderTicketsByCheckoutSessionId(parsed.sessionId)
      : [];
  const requiresPersistedTicket = isTicketingDatabaseConfigured() && checkoutFlow === "reserved_seat";
  const currentTicket =
    persistedTickets.find((ticket) => ticket.ticketIndex === parsed.ticketIndex) || null;
  const currentTicketAssignment = currentTicket?.seatLabel || parsed.seatLabel;
  const paid = session.payment_status === "paid";
  const purchaserName = session.customer_details?.name?.trim() || "Guest";
  const purchaserEmail = session.customer_details?.email?.trim() || "";
  const amountTotal =
    session.amount_total || (tier ? tier.priceCents * Math.max(quantity, 1) : 0);
  const currency = session.currency || "usd";
  const valid =
    paid &&
    session.metadata?.event_slug === eventDetails.slug &&
    session.metadata?.ticket_tier_id === parsed.tierId &&
    quantity >= parsed.ticketIndex &&
    (!requiresPersistedTicket || Boolean(currentTicket && currentTicket.ticketStatus === "active")) &&
    Boolean(tier);

  if (!valid || !tier) {
    return (
      <main className={styles.page}>
        <section className={`${styles.scanCard} ${styles.scanCardInvalid}`}>
          <div className={styles.statusEyebrow}>Verification failed</div>
          <h1 className={styles.scanTitle}>Ticket Not Valid</h1>
          <p className={styles.statusLead}>
            The payment record, event details, or ticket quantity no longer match this QR code.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={`${styles.scanCard} ${styles.scanCardValid}`}>
        <div className={styles.statusEyebrow}>
          {session.livemode ? "Stripe payment confirmed" : "Stripe test payment confirmed"}
        </div>
        <h1 className={styles.scanTitle}>Valid Ticket</h1>
        <div className={styles.scanMeta}>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Ticket Code</span>
            <strong>{createTicketCode(parsed.sessionId, parsed.ticketIndex)}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Ticket Number</span>
            <strong>
              {parsed.ticketIndex} of {quantity}
            </strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>{assignmentFieldLabel}</span>
            <strong>{currentTicketAssignment}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Purchaser</span>
            <strong>{purchaserName}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Email</span>
            <strong>{purchaserEmail || "Collected in Stripe"}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Tier</span>
            <strong>{tier.name}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Paid Amount</span>
            <strong>{formatCurrency(amountTotal, currency)}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Event</span>
            <strong>{eventDetails.name}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Date</span>
            <strong>{formatEventDate(eventDetails.dateIso)}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Venue</span>
            <strong>{eventDetails.venue}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Stripe Session</span>
            <strong>{parsed.sessionId}</strong>
          </div>
        </div>
        <p className={styles.statusLead}>
          {checkoutFlow === "tier_test"
            ? "This verifier confirms the QR signature and checks that the linked Stripe test Checkout session is paid for this event and ticket tier."
            : "This verifier confirms the QR signature and checks that the linked Stripe Checkout session is paid for this event and ticket tier."}
        </p>
      </section>
    </main>
  );
}
