"use client";

import { useMemo, useState } from "react";
import { adminTextAreaProps } from "../adminFormProps";
import { buildAdminRequestHeaders } from "../adminRequestHeaders";
import styles from "../../ticketing.module.css";

type TestCheckoutResult = {
  message?: string;
  quantity?: number;
  seatLabels?: string[];
  testUnitAmountCents?: number;
  url?: string;
};

async function readResponsePayload<T extends { message?: string }>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

function normalizeSeatLabels(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((seatLabel) => seatLabel.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export function AdminTestCheckoutTools() {
  const [seatLabelInput, setSeatLabelInput] = useState("");
  const [smsConsentOptIn, setSmsConsentOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const seatLabels = useMemo(() => normalizeSeatLabels(seatLabelInput), [seatLabelInput]);
  const totalCents = seatLabels.length * 100;

  async function startCheckout() {
    if (seatLabels.length < 1) {
      setError("Enter at least one seat ID before starting the $1 test checkout.");
      return;
    }

    setSubmitting(true);
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/tickets/admin/test-checkout", {
        body: JSON.stringify({
          seatLabels,
          smsConsentOptIn,
        }),
        headers: buildAdminRequestHeaders({
          "content-type": "application/json",
        }),
        method: "POST",
      });
      const payload = await readResponsePayload<TestCheckoutResult>(response);

      if (!response.ok) {
        throw new Error(payload.message || "$1 test checkout could not be started.");
      }

      if (!payload.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      setStatus(
        `Opening Stripe test checkout for ${payload.quantity || seatLabels.length} seat${(payload.quantity || seatLabels.length) === 1 ? "" : "s"}.`,
      );
      window.location.href = payload.url;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "$1 test checkout could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        This creates a live Stripe Checkout for selected real seats at {formatCurrency(100)} per
        seat. It is admin-only and does not create a public $1 ticket tier.
      </div>

      <label className={styles.field}>
        <span>Seat IDs For $1 Live Test</span>
        <textarea
          {...adminTextAreaProps}
          className={styles.textArea}
          onChange={(event) => setSeatLabelInput(event.target.value)}
          placeholder="Example: SV1-1, SV1-2"
          rows={5}
          value={seatLabelInput}
        />
      </label>

      <label className={styles.checkboxField}>
        <input
          checked={smsConsentOptIn}
          onChange={(event) => setSmsConsentOptIn(event.target.checked)}
          type="checkbox"
        />
        <span>Mark SMS consent as opted in for this test order.</span>
      </label>

      <div className={styles.selectionSummary}>
        <div className={styles.selectionCount}>
          <span>Parsed Seats</span>
          <strong>{seatLabels.length}</strong>
        </div>
        <div className={styles.selectionSeats}>
          <span>Seat List</span>
          <strong>{seatLabels.length > 0 ? seatLabels.join(", ") : "None yet"}</strong>
        </div>
        <div className={styles.selectionTier}>
          <span>Stripe Amount</span>
          <strong>{formatCurrency(totalCents)}</strong>
        </div>
      </div>

      <div className={styles.adminActionRow}>
        <button
          className={styles.primaryButton}
          disabled={seatLabels.length < 1 || submitting}
          onClick={startCheckout}
          type="button"
        >
          {submitting ? "Starting $1 Checkout..." : "Start $1 Stripe Checkout"}
        </button>
      </div>

      <div className={styles.notice}>
        Use seats from one pricing zone at a time. If the payment is abandoned, the seats release on
        the normal cart hold timer. If the payment succeeds, refund the $1 charge in Stripe when you
        are done testing.
      </div>

      {status ? <div className={styles.notice}>{status}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
}
