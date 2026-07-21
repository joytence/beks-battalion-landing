import type { Metadata } from "next";
import QRCode from "qrcode";
import { PrintTicketButton } from "../PrintTicketButton";
import styles from "../ticketing.module.css";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  sendReservedSeatReceiptEmail,
  sendReservedSeatSaleNotificationEmail,
} from "@/lib/ticket-email";
import { isTwilioSmsConfigured, normalizePhoneNumber, sendReservedSeatReceiptSms } from "@/lib/ticket-sms";
import {
  claimAdminSaleNotificationEmailSend,
  claimCustomerReceiptEmailSend,
  claimCustomerReceiptSmsSend,
  getOrderTicketsByCheckoutSessionId,
  isTicketingDatabaseConfigured,
  markAdminSaleNotificationEmailFailed,
  markAdminSaleNotificationEmailSent,
  markCustomerReceiptEmailFailed,
  markCustomerReceiptEmailSent,
  markCustomerReceiptSmsFailed,
  markCustomerReceiptSmsSent,
  markCustomerReceiptSmsSkipped,
  syncReservedSeatPaymentConfirmed,
} from "@/lib/ticketing-store";
import {
  createSignedTicketToken,
  createTicketCode,
  eventDetails,
  formatCurrency,
  formatEventDate,
  getCheckoutFlow,
  getSiteUrl,
  parseStripeReceiptAccessToken,
  getTicketAssignmentFieldLabel,
  getTicketAssignmentLabel,
  getTicketTierById,
  parseSeatLabels,
} from "@/lib/ticketing";

export const metadata: Metadata = {
  title: "Ticket Confirmation | Joy Stage Productions",
  description: "Printable electronic tickets with QR verification for Beks Battalion.",
};

type ConfirmationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function buildQrMarkup(value: string) {
  return QRCode.toString(value, {
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
    margin: 2,
    type: "svg",
    width: 256,
  });
}

export default async function TicketConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = (await searchParams) || {};
  const accessToken = typeof params.access === "string" ? params.access : "";
  const parsedAccess = accessToken ? parseStripeReceiptAccessToken(accessToken) : null;
  const sessionId =
    parsedAccess?.sessionId || (typeof params.session_id === "string" ? params.session_id : "");

  if (!isStripeConfigured()) {
    return (
      <main className={styles.receiptPage}>
        <section className={styles.receiptStatusCard}>
          <div className={styles.statusEyebrow}>Stripe setup required</div>
          <h1 className={styles.statusTitle}>Checkout is not configured yet</h1>
          <p className={styles.statusLead}>
            Add `STRIPE_SECRET_KEY` before using the confirmation route.
          </p>
        </section>
      </main>
    );
  }

  if (!sessionId) {
    return (
      <main className={styles.receiptPage}>
        <section className={styles.receiptStatusCard}>
          <div className={styles.statusEyebrow}>Missing session</div>
          <h1 className={styles.statusTitle}>No checkout session was provided</h1>
          <p className={styles.statusLead}>
            Return to the ticket page and start checkout again.
          </p>
        </section>
      </main>
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const checkoutFlow = getCheckoutFlow(session.metadata?.checkout_flow);
  const ticketTierId = session.metadata?.ticket_tier_id || "";
  const seatLabels = parseSeatLabels(session.metadata?.seat_labels || "");
  const quantity = seatLabels.length || Number(session.metadata?.ticket_quantity || "0");
  const tier = getTicketTierById(ticketTierId);

  if (session.payment_status !== "paid" || !tier || quantity < 1) {
    return (
      <main className={styles.receiptPage}>
        <section className={styles.receiptStatusCard}>
          <div className={styles.statusEyebrow}>Payment incomplete</div>
          <h1 className={styles.statusTitle}>Ticket issuance is not available yet</h1>
          <p className={styles.statusLead}>
            This session does not have a paid ticket order attached to it.
          </p>
        </section>
      </main>
    );
  }

  const purchaserName = session.customer_details?.name?.trim() || "Guest";
  const purchaserEmail = session.customer_details?.email?.trim() || session.customer_email?.trim() || "";
  const currency = session.currency || "usd";
  const amountTotal = session.amount_total || tier.priceCents * quantity;
  const siteUrl = getSiteUrl();
  const eventDate = formatEventDate(eventDetails.dateIso);
  const assignmentFieldLabel = getTicketAssignmentFieldLabel(checkoutFlow);
  let emailDeliveryNotice = "";

  if (isTicketingDatabaseConfigured() && checkoutFlow === "reserved_seat") {
    let claimedOrder: Awaited<ReturnType<typeof claimCustomerReceiptEmailSend>> | null = null;
    let claimedAdminSaleOrder:
      | Awaited<ReturnType<typeof claimAdminSaleNotificationEmailSend>>
      | null = null;
    let claimedSmsOrder: Awaited<ReturnType<typeof claimCustomerReceiptSmsSend>> | null = null;

    try {
      await syncReservedSeatPaymentConfirmed(session);
      claimedOrder = await claimCustomerReceiptEmailSend(session.id);

      if (claimedOrder) {
        await sendReservedSeatReceiptEmail({
          livemode: session.livemode ?? false,
          order: claimedOrder,
        });
        await markCustomerReceiptEmailSent(claimedOrder.id);
        emailDeliveryNotice = claimedOrder.purchaserEmail
          ? `Ticket email sent to ${claimedOrder.purchaserEmail}.`
          : "";
      }

      claimedAdminSaleOrder = await claimAdminSaleNotificationEmailSend(session.id);

      if (claimedAdminSaleOrder) {
        await sendReservedSeatSaleNotificationEmail({
          livemode: session.livemode ?? false,
          order: claimedAdminSaleOrder,
        });
        await markAdminSaleNotificationEmailSent(claimedAdminSaleOrder.id);
      }

      if (isTwilioSmsConfigured()) {
        claimedSmsOrder = await claimCustomerReceiptSmsSend(session.id);

        if (claimedSmsOrder) {
          if (!normalizePhoneNumber(claimedSmsOrder.purchaserPhone || "")) {
            await markCustomerReceiptSmsSkipped(claimedSmsOrder.id);
            claimedSmsOrder = null;
          } else {
            await sendReservedSeatReceiptSms({
              livemode: session.livemode ?? false,
              order: claimedSmsOrder,
            });
            await markCustomerReceiptSmsSent(claimedSmsOrder.id);
            claimedSmsOrder = null;
          }
        }
      }
    } catch (error) {
      if (claimedOrder) {
        await markCustomerReceiptEmailFailed(claimedOrder.id);
      }
      if (claimedAdminSaleOrder) {
        await markAdminSaleNotificationEmailFailed(claimedAdminSaleOrder.id);
      }
      if (claimedSmsOrder) {
        await markCustomerReceiptSmsFailed(claimedSmsOrder.id);
      }

      console.error("Confirmation page ticket email fallback error:", error);
      emailDeliveryNotice =
        "We confirmed your payment, but the ticket email could not be sent yet. Please use this page to print your tickets.";
    }
  }

  const persistedTickets =
    isTicketingDatabaseConfigured() && checkoutFlow === "reserved_seat"
      ? await getOrderTicketsByCheckoutSessionId(session.id)
      : [];
  const activePersistedTickets = persistedTickets.filter((ticket) => ticket.ticketStatus === "active");
  const ticketsToRender =
    activePersistedTickets.length > 0
      ? activePersistedTickets.map((ticket) => ({
          seatLabel: ticket.seatLabel,
          ticketIndex: ticket.ticketIndex,
        }))
      : Array.from({ length: quantity }).map((_, index) => ({
          seatLabel: seatLabels[index] || "Unassigned",
          ticketIndex: index + 1,
        }));

  const tickets = await Promise.all(
    ticketsToRender.map(async ({ seatLabel, ticketIndex }) => {
      const assignmentLabel = getTicketAssignmentLabel(
        tier.name,
        seatLabel,
        checkoutFlow,
      );
      const token = createSignedTicketToken({
        eventSlug: eventDetails.slug,
        issuedSource: "stripe",
        sessionId: session.id,
        ticketIndex,
        tierId: tier.id,
        version: 2,
      });
      const verifyUrl = `${siteUrl}/tickets/verify?ticket=${encodeURIComponent(token)}`;
      const qrMarkup = await buildQrMarkup(verifyUrl);

      return {
        code: createTicketCode(session.id, ticketIndex),
        qrMarkup,
        seatLabel: assignmentLabel,
        ticketIndex,
        verifyUrl,
      };
    }),
  );

  return (
    <main className={styles.receiptPage}>
      <section className={styles.receiptStatusCard}>
        <div className={styles.statusEyebrow}>Paid successfully</div>
        <h1 className={styles.statusTitle}>Print-Ready Electronic Tickets</h1>
        <p className={styles.statusLead}>
          Payment has been confirmed. Each QR code links to a signed verification page for this
          order.
        </p>
        {!session.livemode ? (
          <div className={styles.notice}>
            Stripe test mode is active for this order. These tickets are for integration testing
            only and should not be treated as live event admission.
          </div>
        ) : null}
        {emailDeliveryNotice ? <div className={styles.notice}>{emailDeliveryNotice}</div> : null}
        <div className={styles.statusActions}>
          <PrintTicketButton />
          <a className={styles.secondaryButton} href="/tickets">
            Buy More Tickets
          </a>
        </div>
      </section>

      <section className={styles.ticketGrid}>
        {tickets.map((ticket) => (
          <article key={ticket.code} className={styles.ticketCard}>
            <div className={styles.ticketBody}>
              <div className={styles.ticketHeader}>
                <div>
                  <div className={styles.ticketLabel}>Joy Stage Productions</div>
                  <h2 className={styles.ticketTitle}>{eventDetails.name}</h2>
                </div>
                <div className={styles.ticketPrice}>{formatCurrency(tier.priceCents, currency)}</div>
              </div>

              <div className={styles.ticketMeta}>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Ticket Code</span>
                  <strong className={styles.ticketCode}>{ticket.code}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Ticket Number</span>
                  <strong>
                    {ticket.ticketIndex} of {quantity}
                  </strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>{assignmentFieldLabel}</span>
                  <strong>{ticket.seatLabel}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Purchaser</span>
                  <strong>{purchaserName}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Email</span>
                  <strong>{purchaserEmail || "Collected in Stripe"}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Tier</span>
                  <strong>{tier.name}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Order Total</span>
                  <strong>{formatCurrency(amountTotal, currency)}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Date</span>
                  <strong>{eventDate}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Venue</span>
                  <strong>{eventDetails.venue}</strong>
                </div>
              </div>

              <p className={styles.ticketNotes}>
                {checkoutFlow === "tier_test"
                  ? "This test-only ticket confirms the Stripe payment flow and QR verification flow without assigning a reserved seat."
                  : "Present this ticket at the door. Scanning the QR code opens a signed verification page that confirms the paid Stripe session for this ticket order."}
              </p>
            </div>

            <div className={styles.qrPanel}>
              <div
                className={styles.qrFrame}
                dangerouslySetInnerHTML={{ __html: ticket.qrMarkup }}
              />
              <div className={styles.qrCaption}>
                Scan to verify this ticket.
                <br />
                Ref: {ticket.code}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
