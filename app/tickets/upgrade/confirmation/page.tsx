import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "../../ticketing.module.css";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  eventDetails,
  getStripeReceiptUrl,
  getTicketTierById,
} from "@/lib/ticketing";
import {
  getTicketOrderById,
  isTicketingDatabaseConfigured,
  syncTicketUpgradePaymentConfirmed,
} from "@/lib/ticketing-store";

export const metadata: Metadata = {
  title: "Upgrade Confirmed | Joy Stage Productions",
  description: "SVIP ticket upgrade confirmation for Beks Battalion.",
};

type UpgradeConfirmationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TicketUpgradeConfirmationPage({
  searchParams,
}: UpgradeConfirmationPageProps) {
  const params = (await searchParams) || {};
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";

  if (!isStripeConfigured() || !sessionId) {
    return (
      <main className={styles.page}>
        <section className={styles.sectionCard}>
          <div className={styles.eyebrow}>Upgrade confirmation</div>
          <h1 className={styles.title}>Missing upgrade session</h1>
          <p className={styles.lead}>Return to your ticket receipt and try the upgrade again.</p>
        </section>
      </main>
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (
    session.payment_status !== "paid" ||
    session.metadata?.checkout_flow !== "ticket_upgrade" ||
    !session.metadata?.order_id
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.sectionCard}>
          <div className={styles.eyebrow}>Upgrade confirmation</div>
          <h1 className={styles.title}>Payment is not confirmed yet</h1>
          <p className={styles.lead}>Stripe has not confirmed this upgrade as paid.</p>
        </section>
      </main>
    );
  }

  if (isTicketingDatabaseConfigured()) {
    await syncTicketUpgradePaymentConfirmed(session);
  }

  const order = isTicketingDatabaseConfigured()
    ? await getTicketOrderById(session.metadata.order_id)
    : null;
  const receiptSessionId = order?.checkoutSessionId || session.metadata.original_checkout_session_id || "";

  if (!receiptSessionId) {
    redirect("/tickets");
  }

  const tier = getTicketTierById(order?.ticketTierId || "svip");

  return (
    <main className={styles.page}>
      <section className={styles.sectionCard}>
        <div className={styles.eyebrow}>Upgrade confirmed</div>
        <h1 className={styles.title}>Your tickets are now SVIP</h1>
        <p className={styles.lead}>
          Your existing seats remain assigned, and your {eventDetails.name} order has been upgraded
          to {tier?.name || "SVIP"}.
        </p>
        <a className={styles.primaryButton} href={getStripeReceiptUrl(receiptSessionId)}>
          Open Updated Tickets
        </a>
      </section>
    </main>
  );
}
