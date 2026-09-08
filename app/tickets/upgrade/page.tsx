import type { Metadata } from "next";
import { UpgradeCheckoutClient } from "./UpgradeCheckoutClient";
import styles from "../ticketing.module.css";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  formatCurrency,
  getTicketTierById,
  parseTicketUpgradeAccessToken,
} from "@/lib/ticketing";
import {
  getTicketOrderByCheckoutSessionId,
  isTicketingDatabaseConfigured,
} from "@/lib/ticketing-store";

export const metadata: Metadata = {
  title: "Upgrade Tickets | Joy Stage Productions",
  description: "Upgrade eligible Beks Battalion tickets to SVIP.",
};

type UpgradePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TicketUpgradePage({ searchParams }: UpgradePageProps) {
  const params = (await searchParams) || {};
  const access = typeof params.access === "string" ? params.access : "";
  const parsedAccess = access ? parseTicketUpgradeAccessToken(access) : null;

  if (!parsedAccess || !isStripeConfigured() || !isTicketingDatabaseConfigured()) {
    return (
      <main className={styles.page}>
        <section className={styles.sectionCard}>
          <div className={styles.eyebrow}>Ticket upgrade</div>
          <h1 className={styles.title}>This upgrade link is unavailable</h1>
          <p className={styles.lead}>Please use the secure upgrade link from your ticket receipt.</p>
        </section>
      </main>
    );
  }

  const stripe = getStripe();
  const originalSession = await stripe.checkout.sessions.retrieve(parsedAccess.sessionId);
  const order = await getTicketOrderByCheckoutSessionId(originalSession.id);
  const currentTier = order ? getTicketTierById(order.ticketTierId) : null;
  const svipTier = getTicketTierById("svip");
  const upgradeSubtotal =
    order && currentTier && svipTier
      ? (svipTier.priceCents - currentTier.priceCents) * order.ticketQuantity
      : 0;

  if (
    originalSession.payment_status !== "paid" ||
    !order ||
    order.orderStatus !== "paid" ||
    !currentTier ||
    !svipTier ||
    currentTier.id === "svip" ||
    upgradeSubtotal <= 0
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.sectionCard}>
          <div className={styles.eyebrow}>Ticket upgrade</div>
          <h1 className={styles.title}>This order is not eligible for an upgrade</h1>
          <p className={styles.lead}>
            The order may already be SVIP, may not be paid, or may no longer be available for upgrade.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.sectionCard}>
        <div className={styles.eyebrow}>Secure ticket upgrade</div>
        <h1 className={styles.title}>Upgrade to SVIP</h1>
        <p className={styles.lead}>
          Upgrade your {order.ticketQuantity} {currentTier.name} ticket{order.ticketQuantity === 1 ? "" : "s"} to SVIP.
          Your existing seat assignment will stay the same.
        </p>
        <div className={styles.statusCard}>
          <div>
            <span className={styles.ticketLabel}>Upgrade balance</span>
            <strong>{formatCurrency(upgradeSubtotal)}</strong>
          </div>
          <div>
            <span className={styles.ticketLabel}>Current tier</span>
            <strong>{currentTier.name}</strong>
          </div>
          <div>
            <span className={styles.ticketLabel}>New tier</span>
            <strong>{svipTier.name}</strong>
          </div>
        </div>
        <UpgradeCheckoutClient access={access} />
      </section>
    </main>
  );
}
