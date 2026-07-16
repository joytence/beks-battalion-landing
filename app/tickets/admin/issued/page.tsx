import type { Metadata } from "next";
import QRCode from "qrcode";
import { PrintTicketButton } from "../../PrintTicketButton";
import styles from "../../ticketing.module.css";
import { getTicketOrderById, isTicketingDatabaseConfigured } from "@/lib/ticketing-store";
import {
  parseAdminIssuedReceiptAccessToken,
  createSignedTicketToken,
  createTicketCode,
  eventDetails,
  formatCurrency,
  formatEventDate,
  getSiteUrl,
  getTicketTierById,
} from "@/lib/ticketing";

export const metadata: Metadata = {
  title: "Admin Issued Tickets | Joy Stage Productions",
  description: "Printable sponsor and comp tickets issued from the admin controls.",
};

type AdminIssuedPageProps = {
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

export default async function TicketAdminIssuedPage({ searchParams }: AdminIssuedPageProps) {
  const params = (await searchParams) || {};
  const accessToken = typeof params.access === "string" ? params.access : "";
  const parsedAccess = accessToken ? parseAdminIssuedReceiptAccessToken(accessToken) : null;
  const orderId =
    parsedAccess?.orderId || (typeof params.order_id === "string" ? params.order_id : "");

  if (!isTicketingDatabaseConfigured()) {
    return (
      <main className={styles.receiptPage}>
        <section className={styles.receiptStatusCard}>
          <div className={styles.statusEyebrow}>Database required</div>
          <h1 className={styles.statusTitle}>Ticket storage is not configured yet</h1>
          <p className={styles.statusLead}>
            Add `DATABASE_URL` before using the admin-issued ticket flow.
          </p>
        </section>
      </main>
    );
  }

  if (!orderId) {
    return (
      <main className={styles.receiptPage}>
        <section className={styles.receiptStatusCard}>
          <div className={styles.statusEyebrow}>Missing access</div>
          <h1 className={styles.statusTitle}>No issued ticket link was provided</h1>
          <p className={styles.statusLead}>
            Return to the admin issue flow and generate the tickets again, or use the signed
            receipt link that was emailed to the recipient.
          </p>
        </section>
      </main>
    );
  }

  const order = await getTicketOrderById(orderId);

  if (!order || order.orderStatus !== "paid" || order.tickets.length < 1) {
    return (
      <main className={styles.receiptPage}>
        <section className={styles.receiptStatusCard}>
          <div className={styles.statusEyebrow}>Order unavailable</div>
          <h1 className={styles.statusTitle}>Issued tickets could not be found</h1>
          <p className={styles.statusLead}>
            This order does not have issued tickets attached to it.
          </p>
        </section>
      </main>
    );
  }

  const tier = getTicketTierById(order.ticketTierId);

  if (!tier) {
    return (
      <main className={styles.page}>
        <section className={styles.statusCard}>
          <div className={styles.statusEyebrow}>Tier unavailable</div>
          <h1 className={styles.statusTitle}>Ticket tier could not be resolved</h1>
          <p className={styles.statusLead}>
            The issued ticket order is missing a valid pricing tier.
          </p>
        </section>
      </main>
    );
  }

  const siteUrl = getSiteUrl();
  const quantity = order.ticketQuantity;
  const eventDate = formatEventDate(eventDetails.dateIso);
  const issuedAt = order.paidAt ? Math.floor(order.paidAt.getTime() / 1000) : Math.floor(Date.now() / 1000);
  const tickets = await Promise.all(
    order.tickets.map(async (ticket) => {
      const token = createSignedTicketToken({
        eventSlug: eventDetails.slug,
        issuedOrderId: order.id,
        issuedSource: "admin",
        sessionId: order.checkoutSessionId,
        ticketIndex: ticket.ticketIndex,
        tierId: order.ticketTierId,
        version: 2,
      });
      const verifyUrl = `${siteUrl}/tickets/verify?ticket=${encodeURIComponent(token)}`;
      const qrMarkup = await buildQrMarkup(verifyUrl);

      return {
        code: createTicketCode(order.checkoutSessionId, ticket.ticketIndex),
        qrMarkup,
        seatLabel: ticket.seatLabel,
        ticketIndex: ticket.ticketIndex,
      };
    }),
  );

  return (
    <main className={styles.receiptPage}>
      <section className={styles.receiptStatusCard}>
        <div className={styles.statusEyebrow}>Admin-issued admission</div>
        <h1 className={styles.statusTitle}>Print-Ready Sponsor And Comp Tickets</h1>
        <p className={styles.statusLead}>
          These tickets were issued from the admin controls for blocked seats and did not go
          through Stripe Checkout.
        </p>
        <div className={styles.notice}>
          Use this receipt for sponsor, comp, or internal guest admissions. Each QR code opens a
          signed verification page for this issued order.
        </div>
        <div className={styles.statusActions}>
          <PrintTicketButton />
          <a className={styles.secondaryButton} href="/tickets/admin/issue">
            Issue More Tickets
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
                <div className={styles.ticketPrice}>{formatCurrency(tier.priceCents, order.currency)}</div>
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
                  <span className={styles.ticketLabel}>Seat</span>
                  <strong>{ticket.seatLabel}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Recipient</span>
                  <strong>{order.purchaserName}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Email</span>
                  <strong>{order.purchaserEmail || "Not provided"}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Tier</span>
                  <strong>{tier.name}</strong>
                </div>
                <div className={styles.ticketMetaItem}>
                  <span className={styles.ticketLabel}>Admission Value</span>
                  <strong>{formatCurrency(order.amountTotal || 0, order.currency)}</strong>
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
                Present this ticket at the door. Scanning the QR code confirms this seat was issued
                directly from the admin tool for sponsor or comp admission.
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
