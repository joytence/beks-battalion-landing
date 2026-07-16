import type { Metadata } from "next";
import { AdminReleaseTools } from "../AdminReleaseTools";
import styles from "../../ticketing.module.css";

export const metadata: Metadata = {
  title: "Release Paid Seats | Joy Stage Productions",
  description: "Reopen paid seats after a refund or admin cancellation and invalidate the old QR.",
};

export default function TicketAdminReleasePage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin">
            Back to Seat Admin
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Back to Ticket Page
          </a>
        </div>

        <div className={styles.eyebrow}>Admin Tools</div>
        <h1 className={styles.title}>Release Paid Seats And Reopen The Map</h1>
        <p className={styles.lead}>
          Use this after a paid ticket should no longer be honored. The seat becomes available
          again and the previous ticket QR stops verifying as valid.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Paid Seat Release</div>
          <h2 className={styles.sectionTitle}>Invalidate the old ticket and reopen the seat</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminReleaseTools />
        </div>
      </section>
    </main>
  );
}
