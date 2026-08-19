import type { Metadata } from "next";
import { AdminTestCheckoutTools } from "./AdminTestCheckoutTools";
import styles from "../../ticketing.module.css";

export const metadata: Metadata = {
  title: "$1 Ticket Test Checkout | Joy Stage Productions",
  description: "Admin-only live Stripe test checkout for selected reserved seats.",
};

export default function TicketAdminTestCheckoutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin">
            Back to Seat Admin
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/seats">
            Seat Database
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/recover">
            Recover Paid Tickets
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Public Ticket Page
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/api/tickets/admin/logout">
            Sign Out
          </a>
        </div>

        <div className={styles.eyebrow}>Admin Test Checkout</div>
        <h1 className={styles.title}>Create Private $1 Stripe Seat Tests</h1>
        <p className={styles.lead}>
          Start a hidden admin-only checkout for selected real seats at one dollar per seat. This is
          for verifying live payment, confirmation, email, ticket, and tracking behavior without
          exposing discounted seats publicly.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Live Payment Test</div>
          <h2 className={styles.sectionTitle}>Private $1 test checkout</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminTestCheckoutTools />
        </div>
      </section>
    </main>
  );
}
