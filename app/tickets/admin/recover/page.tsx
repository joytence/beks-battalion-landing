import type { Metadata } from "next";
import { AdminPaidRecoveryTools } from "./AdminPaidRecoveryTools";
import styles from "../../ticketing.module.css";

export const metadata: Metadata = {
  title: "Paid Ticket Recovery | Joy Stage Productions",
  description: "Recover, reopen, and resend real paid Stripe tickets without the seat database loader.",
};

export default function TicketAdminRecoveryPage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin">
            Back to Seat Admin
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/issue">
            Issue QR Tickets
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/seats">
            Seat Database
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Public Ticket Page
          </a>
        </div>

        <div className={styles.eyebrow}>Paid Ticket Recovery</div>
        <h1 className={styles.title}>Find Paid Orders And Resend Tickets Fast</h1>
        <p className={styles.lead}>
          Search by seat number, order ID, Stripe checkout session, email, phone, or customer name.
          You can also load the most recent paid orders and reopen or resend them from one page.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Recovery Tools</div>
          <h2 className={styles.sectionTitle}>Paid ticket recovery</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminPaidRecoveryTools />
        </div>
      </section>
    </main>
  );
}
