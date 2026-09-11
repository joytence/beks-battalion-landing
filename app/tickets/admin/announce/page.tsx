import type { Metadata } from "next";
import { AdminAnnouncementTools } from "./AdminAnnouncementTools";
import styles from "../../ticketing.module.css";

export const metadata: Metadata = {
  title: "Text Announcements | Joy Stage Productions",
  description: "Send approved event announcements from the Joy Stage Productions ticket admin.",
};

export default function TicketAdminAnnouncementPage() {
  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin">
            Back to Ticket Admin
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/recover">
            Recover Paid Tickets
          </a>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets/admin/seats">
            Seat Database
          </a>
        </div>

        <div className={styles.eyebrow}>Ticket Announcements</div>
        <h1 className={styles.title}>Send A Text Announcement</h1>
        <p className={styles.lead}>
          Paste a recipient list, review the exact message, and send it from the same Joy Stage
          Productions text sender used for ticket notifications.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Announcement Composer</div>
          <h2 className={styles.sectionTitle}>Text recipients directly</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminAnnouncementTools />
        </div>
      </section>
    </main>
  );
}
