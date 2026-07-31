"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import styles from "../../ticketing.module.css";

type LoginResponse = {
  message?: string;
  redirectTo?: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/tickets/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!password.trim()) {
      setError("Enter the admin password.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tickets/admin/login", {
        body: JSON.stringify({
          next,
          password,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok) {
        throw new Error(payload.message || "Admin login failed.");
      }

      router.replace(payload.redirectTo || next);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Admin login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        Sign in once to open the ticket admin area. The browser receives a secure admin session
        cookie instead of resending the shared password on every page action.
      </div>

      <label className={styles.field}>
        <span>Admin Password</span>
        <input
          autoComplete="current-password"
          className={styles.textInput}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Enter the admin password"
          type="password"
          value={password}
        />
      </label>

      <div className={styles.adminActionRow}>
        <button
          className={styles.primaryButton}
          disabled={submitting || !password.trim()}
          onClick={() => void submit()}
          type="button"
        >
          {submitting ? "Signing In..." : "Sign In"}
        </button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}
