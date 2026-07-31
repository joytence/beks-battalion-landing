import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "./AdminLoginForm";
import styles from "../../ticketing.module.css";
import {
  getTicketAdminSessionCookieName,
  isValidTicketAdminSessionToken,
  sanitizeAdminNextPath,
} from "@/lib/ticket-admin-auth";

export const metadata: Metadata = {
  title: "Ticket Admin Login | Joy Stage Productions",
  description: "Secure sign-in for Joy Stage Productions ticket admin tools.",
  robots: {
    index: false,
    follow: false,
  },
};

type LoginPageProps = {
  searchParams?: {
    next?: string;
  };
};

export default async function TicketAdminLoginPage({ searchParams }: LoginPageProps) {
  const nextPath = sanitizeAdminNextPath(searchParams?.next || "/tickets/admin");
  const sessionToken = cookies().get(getTicketAdminSessionCookieName())?.value || "";

  if (sessionToken && (await isValidTicketAdminSessionToken(sessionToken))) {
    redirect(nextPath);
  }

  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroActionRow}>
          <a className={`${styles.secondaryButton} ${styles.backLink}`} href="/tickets">
            Back to Ticket Page
          </a>
        </div>

        <div className={styles.eyebrow}>Admin Login</div>
        <h1 className={styles.title}>Secure Ticket Admin Access</h1>
        <p className={styles.lead}>
          This area now uses a signed admin session cookie. Sign in once, manage the ticket admin
          tools, and sign out when you are done.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Protected Access</div>
          <h2 className={styles.sectionTitle}>Sign in to continue</h2>
        </div>

        <div className={styles.checkoutShell}>
          <AdminLoginForm />
        </div>
      </section>
    </main>
  );
}
