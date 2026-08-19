import type { Metadata } from "next";
import { AdminIssueTools } from "../AdminIssueTools";
import styles from "../../ticketing.module.css";

export const metadata: Metadata = {
  title: "Issue Admin Tickets | Joy Stage Productions",
  description: "Issue sponsor and comp QR tickets from blocked seats or open seats in one admin flow.",
};

export default function TicketAdminIssuePage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin">
            Back to Seat Admin
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/release">
            Release Paid Seats
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/test-checkout">
            $1 Test Checkout
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Back to Ticket Page
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/api/tickets/admin/logout">
            Sign Out
          </a>
        </div>

        <div className={styles.eyebrow}>Admin Tools</div>
        <h1 className={styles.title}>Issue Sponsor And Comp QR Tickets</h1>
        <p className={styles.lead}>
          Use blocked seats that are already reserved, or auto-lock open seats during issue, to
          create printable tickets and verification QR codes without taking payment through Stripe
          Checkout.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Issue Tickets</div>
          <h2 className={styles.sectionTitle}>Generate printable admission passes</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminIssueTools />
        </div>
      </section>
    </main>
  );
}
