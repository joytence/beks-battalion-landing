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
  formatCurrency,
  getTicketTierById,
  getTicketSeatChart,
  ticketTiers,
} from "@/lib/ticketing";

export const metadata: Metadata = {
  title: "Electronic Tickets | Joy Stage Productions",
  description: "Electronic tickets and reserved seat selection for the Beks Battalion live show.",
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
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/">
            Back to Event Page
          </a>
        </div>

        <div className={styles.eyebrow}>
          {reservedSeatReady ? "Electronic Tickets" : "Electronic Ticketing"}
        </div>
        <h1 className={styles.title}>
          Choose Your Seats
        </h1>
        <p className={styles.lead}>
          Select SVIP, VIP, or General Admission, then pick your reserved seats and checkout securely
          with Stripe.
        </p>

      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Step 1</div>
          <h2 className={styles.sectionTitle}>Choose Your Ticket Section</h2>
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
