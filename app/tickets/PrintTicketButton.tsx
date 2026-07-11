"use client";

import styles from "./ticketing.module.css";

export function PrintTicketButton() {
  return (
    <button className={styles.secondaryButton} type="button" onClick={() => window.print()}>
      Print Ticket
    </button>
  );
}
