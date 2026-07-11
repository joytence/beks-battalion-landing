import type { Metadata } from "next";
import { TicketCheckoutClient } from "./TicketCheckoutClient";
import styles from "./ticketing.module.css";
import {
  isStripeConfigured,
  isStripeTestMode,
  isTicketCheckoutEnabled,
  isTicketTierTestCheckoutEnabled,
} from "@/lib/stripe";
import { getUnavailableSeatLabels, isTicketingDatabaseConfigured } from "@/lib/ticketing-store";
import {
  eventDetails,
  formatCurrency,
  formatEventDate,
  getTicketTierById,
  getTicketSeatChart,
  ticketTiers,
} from "@/lib/ticketing";

export const metadata: Metadata = {
  title: "Electronic Tickets | Joy Stage Productions",
  description: "Electronic ticketing draft and seat-selection preview for the Beks Battalion live show.",
};

type TicketsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const params = (await searchParams) || {};
  const canceled = params.canceled === "1";
  const requestedTier =
    typeof params.tier === "string" ? params.tier.trim().toLowerCase() : "";
  const seatMapOnly = params.view === "seats";
  const initialTierId = getTicketTierById(requestedTier)?.id || "";
  const configured = isStripeConfigured();
  const stripeTestMode = isStripeTestMode();
  const databaseConfigured = isTicketingDatabaseConfigured();
  const checkoutEnabled = isTicketCheckoutEnabled();
  const tierTestCheckoutEnabled = isTicketTierTestCheckoutEnabled();
  const tierTestReady = tierTestCheckoutEnabled && configured && stripeTestMode;
  const reservedSeatReady = checkoutEnabled && configured && databaseConfigured;
  const unavailableSeatLabels = databaseConfigured ? await getUnavailableSeatLabels() : new Set<string>();
  const seatChart = getTicketSeatChart({ blockedSeatLabels: unavailableSeatLabels });
  const tiers = ticketTiers.map((tier) => ({
    ...tier,
    priceLabel: formatCurrency(tier.priceCents),
  }));

  if (seatMapOnly) {
    return (
      <main className={styles.page}>
        <TicketCheckoutClient
          canceled={canceled}
          checkoutEnabled={checkoutEnabled}
          configured={configured}
          databaseConfigured={databaseConfigured}
          initialTierId={initialTierId}
          seatChart={seatChart}
          seatMapOnly={true}
          stripeTestMode={stripeTestMode}
          tierTestCheckoutEnabled={tierTestCheckoutEnabled}
          tiers={tiers}
        />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/">
          Back to Event Page
        </a>

        <div className={styles.eyebrow}>Electronic Ticketing Draft</div>
        <h1 className={styles.title}>Electronic Tickets And Seat Map Preview</h1>
        <p className={styles.lead}>
          {tierTestReady
            ? "This route stays isolated from the landing page while reserved seating is still draft-only. Tier checkout is live in Stripe test mode, and the seat map remains a preview."
            : "This route stays isolated from the landing page while the live Stripe payment flow is being finalized. You can still review tiers and the bird&apos;s-eye seat map, but payment is temporarily paused."}
        </p>

        <div className={styles.eventSummary}>
          <div>
            <span className={styles.summaryLabel}>Event</span>
            <strong>{eventDetails.name}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>Date</span>
            <strong>{formatEventDate(eventDetails.dateIso)}</strong>
          </div>
          <div>
            <span className={styles.summaryLabel}>Venue</span>
            <strong>{eventDetails.venue}</strong>
          </div>
        </div>

        {tierTestReady ? (
          <div className={styles.setupBox}>
            Stripe test checkout is enabled for tier-only orders. Use a Stripe test card like
            `4242 4242 4242 4242` with any future date and CVC. The seat map remains preview-only.
          </div>
        ) : checkoutEnabled && configured && !databaseConfigured ? (
          <div className={styles.setupBox}>
            Reserved-seat checkout still needs `DATABASE_URL` before live payments can safely lock
            sold seats and admin overrides.
          </div>
        ) : tierTestCheckoutEnabled && !configured ? (
          <div className={styles.setupBox}>
            Tier test checkout is turned on, but `STRIPE_SECRET_KEY` is not configured yet. Add a
            Stripe test secret key before using this flow.
          </div>
        ) : tierTestCheckoutEnabled && configured && !stripeTestMode ? (
          <div className={styles.setupBox}>
            Tier test checkout is turned on, but the current `STRIPE_SECRET_KEY` is not a Stripe
            test key. Swap in a test secret key before using this flow.
          </div>
        ) : !checkoutEnabled ? (
          <div className={styles.setupBox}>
            Ticket payments are temporarily paused while Stripe is being finalized. Seat selection
            stays visible so you can keep refining the layout safely.
          </div>
        ) : !configured ? (
          <div className={styles.setupBox}>
            Stripe is not configured yet. Add `STRIPE_SECRET_KEY` before using live checkout. For
            signed QR verification in production, also add `TICKET_SIGNING_SECRET`,
            `NEXT_PUBLIC_SITE_URL`, and `STRIPE_WEBHOOK_SECRET`.
          </div>
        ) : null}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Choose Tickets</div>
          <h2 className={styles.sectionTitle}>
            {tierTestReady
              ? "Tier test checkout with seat map preview"
              : reservedSeatReady
              ? "Hosted payment, then instant printable tickets"
              : "Seat selection preview while payments are paused"}
          </h2>
        </div>

        <TicketCheckoutClient
          canceled={canceled}
          checkoutEnabled={checkoutEnabled}
          configured={configured}
          databaseConfigured={databaseConfigured}
          initialTierId={initialTierId}
          seatChart={seatChart}
          seatMapOnly={false}
          stripeTestMode={stripeTestMode}
          tierTestCheckoutEnabled={tierTestCheckoutEnabled}
          tiers={tiers}
        />
      </section>
    </main>
  );
}
