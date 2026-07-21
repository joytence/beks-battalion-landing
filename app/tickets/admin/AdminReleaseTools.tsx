"use client";

import { useMemo, useState } from "react";
import { buildAdminRequestHeaders } from "./adminRequestHeaders";
import styles from "../ticketing.module.css";

type ReleaseResult = {
  message?: string;
  notPaidSeatLabels?: string[];
  releasedSeatLabels?: string[];
};

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

export function AdminReleaseTools() {
  const [adminSecret, setAdminSecret] = useState("");
  const [actorLabel, setActorLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [seatLabelInput, setSeatLabelInput] = useState("");
  const [result, setResult] = useState<ReleaseResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const seatLabels = useMemo(() => normalizeSeatLabels(seatLabelInput), [seatLabelInput]);
  const canSubmit = adminSecret.trim().length > 0 && seatLabels.length > 0;

  async function submit() {
    if (!canSubmit) {
      setError("Enter the admin secret and at least one paid seat.");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/tickets/admin/release", {
        body: JSON.stringify({
          actorLabel: actorLabel.trim() || "Admin Paid Seat Release",
          notes: notes.trim(),
          seatLabels,
        }),
        headers: buildAdminRequestHeaders(adminSecret, {
          "content-type": "application/json",
        }),
        method: "POST",
      });

      const payload = (await response.json()) as ReleaseResult;

      if (!response.ok) {
        throw new Error(payload.message || "Paid seat release failed.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Paid seat release failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        Use this only after you have already refunded or otherwise decided to invalidate a paid
        ticket. This will reopen the seat on the map and invalidate the previous QR for that seat.
      </div>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Admin Secret</span>
          <input
            autoComplete="off"
            className={styles.textInput}
            onChange={(event) => setAdminSecret(event.target.value)}
            placeholder="Enter TICKET_ADMIN_SECRET"
            type="password"
            value={adminSecret}
          />
        </label>

        <label className={styles.field}>
          <span>Release Reason</span>
          <input
            className={styles.textInput}
            onChange={(event) => setActorLabel(event.target.value)}
            placeholder="Refunded payment, guest transfer, admin correction"
            type="text"
            value={actorLabel}
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Actual Visible Seat IDs From Map</span>
        <textarea
          className={styles.textArea}
          onChange={(event) => setSeatLabelInput(event.target.value)}
          placeholder="SA10-2, SB4-6"
          rows={5}
          value={seatLabelInput}
        />
      </label>

      <label className={styles.field}>
        <span>Additional Notes</span>
        <textarea
          className={styles.textArea}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Document the refund or reason this paid seat is being reopened"
          rows={3}
          value={notes}
        />
      </label>

      <div className={styles.adminActionRow}>
        <button
          className={styles.primaryButton}
          disabled={!canSubmit || submitting}
          onClick={submit}
          type="button"
        >
          {submitting ? "Reopening Seats..." : "Release Paid Seats"}
        </button>
      </div>

      <div className={styles.selectionSummary}>
        <div className={styles.selectionCount}>
          <span>Parsed Seats</span>
          <strong>{seatLabels.length}</strong>
        </div>
        <div className={styles.selectionSeats}>
          <span>Seat List</span>
          <strong>{seatLabels.length > 0 ? seatLabels.join(", ") : "None yet"}</strong>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {result ? (
        <div className={styles.paymentStatusBox}>
          <div className={styles.paymentStatusLabel}>Release Result</div>
          <pre className={styles.adminResult}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
