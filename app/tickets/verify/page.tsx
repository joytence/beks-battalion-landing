import type { Metadata } from "next";
import styles from "../ticketing.module.css";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getOrderTicketsByCheckoutSessionId, isTicketingDatabaseConfigured } from "@/lib/ticketing-store";
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

  if (!isStripeConfigured() || !parsed) {
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

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(parsed.sessionId);
  const checkoutFlow = getCheckoutFlow(session.metadata?.checkout_flow);
  const tier = getTicketTierById(parsed.tierId);
  const quantity = Number(session.metadata?.ticket_quantity || "0");
  const assignmentFieldLabel = getTicketAssignmentFieldLabel(checkoutFlow);
  const persistedTickets =
    isTicketingDatabaseConfigured() && checkoutFlow === "reserved_seat"
      ? await getOrderTicketsByCheckoutSessionId(parsed.sessionId)
      : [];
  const currentTicketAssignment =
    persistedTickets.find((ticket) => ticket.ticketIndex === parsed.ticketIndex)?.seatLabel ||
    parsed.seatLabel;
  const paid = session.payment_status === "paid";
  const valid =
    paid &&
    session.metadata?.event_slug === eventDetails.slug &&
    session.metadata?.ticket_tier_id === parsed.tierId &&
    quantity >= parsed.ticketIndex &&
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
              {parsed.ticketIndex} of {parsed.quantity}
            </strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>{assignmentFieldLabel}</span>
            <strong>{currentTicketAssignment}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Purchaser</span>
            <strong>{parsed.purchaserName}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Email</span>
            <strong>{parsed.purchaserEmail || "Collected in Stripe"}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Tier</span>
            <strong>{tier.name}</strong>
          </div>
          <div className={styles.scanMetaItem}>
            <span className={styles.ticketLabel}>Paid Amount</span>
            <strong>{formatCurrency(parsed.amountTotal, parsed.currency)}</strong>
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
            ? "This draft verifier confirms the QR signature and checks that the linked Stripe test Checkout session is paid for this event and ticket tier."
            : "This draft verifier confirms the QR signature and checks that the linked Stripe Checkout session is paid for this event and ticket tier."}
        </p>
      </section>
    </main>
  );
}
