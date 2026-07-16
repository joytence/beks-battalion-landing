import type { Metadata } from "next";
import { AdminSeatTools } from "./AdminSeatTools";
import styles from "../ticketing.module.css";

export const metadata: Metadata = {
  title: "Ticket Seat Admin | Joy Stage Productions",
  description: "Block or unblock ticket seats before taking reserved-seat payments live.",
};

export default function TicketAdminPage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Back to Ticket Page
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/issue">
            Issue QR Tickets
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/release">
            Release Paid Seats
          </a>
        </div>

        <div className={styles.eyebrow}>Seat Control</div>
        <h1 className={styles.title}>Block Or Unblock Seats Before Live Payments</h1>
        <p className={styles.lead}>
          Use this page to reserve sponsor, guest, or internal seats before turning on reserved-seat
          checkout. Nothing happens here unless the correct admin secret is supplied.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Admin Tools</div>
          <h2 className={styles.sectionTitle}>Seat blackout controls</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminSeatTools />
        </div>
      </section>
    </main>
  );
}
