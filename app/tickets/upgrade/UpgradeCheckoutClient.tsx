"use client";

import { useState } from "react";
import styles from "../ticketing.module.css";

export function UpgradeCheckoutClient({ access }: { access: string }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startUpgrade() {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tickets/upgrade", {
        body: JSON.stringify({ access }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { message?: string; url?: string };

      if (!response.ok || !result.url) {
        throw new Error(result.message || "The upgrade checkout could not be started.");
      }

      window.location.assign(result.url);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The upgrade could not be started.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button className={styles.primaryButton} disabled={submitting} onClick={startUpgrade} type="button">
        {submitting ? "Opening secure checkout..." : "Upgrade to SVIP"}
      </button>
      {error ? <div className={styles.error}>{error}</div> : null}
    </>
  );
}
