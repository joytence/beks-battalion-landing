import type { Metadata } from "next";
import { AdminSeatDatabaseTools } from "./AdminSeatDatabaseTools";
import styles from "../../ticketing.module.css";

export const metadata: Metadata = {
  title: "Seat Database | Joy Stage Productions",
  description: "Admin-only seat database for Beks Battalion ticketing.",
};

export default function TicketSeatDatabasePage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin">
            Back to Seat Control
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/issue">
            Issue QR Tickets
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/release">
            Release Paid Seats
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Public Ticket Page
          </a>
        </div>

        <div className={styles.eyebrow}>Seat Database</div>
        <h1 className={styles.title}>All Seats And Availability</h1>
        <p className={styles.lead}>
          Load the full seat list, current unavailable seats, paid assignments, blocks, checkout
          holds, released seats, and expired holds from the ticketing database.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Admin Report</div>
          <h2 className={styles.sectionTitle}>Seat assignment database</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminSeatDatabaseTools />
        </div>
      </section>
    </main>
  );
}
