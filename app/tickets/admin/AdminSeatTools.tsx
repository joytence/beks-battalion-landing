"use client";

import { useMemo, useState } from "react";
import { buildAdminRequestHeaders } from "./adminRequestHeaders";
import styles from "../ticketing.module.css";

type AdminAction = "block" | "unblock";

type ActionResult = {
  alreadyBlockedSeatLabels?: string[];
  blockedSeatLabels?: string[];
  message?: string;
  notBlockedSeatLabels?: string[];
  unblockedSeatLabels?: string[];
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

export function AdminSeatTools() {
  const [adminSecret, setAdminSecret] = useState("");
  const [actorLabel, setActorLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [seatLabelInput, setSeatLabelInput] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState("");
  const [submittingAction, setSubmittingAction] = useState<AdminAction | "">("");

  const seatLabels = useMemo(() => normalizeSeatLabels(seatLabelInput), [seatLabelInput]);
  const canSubmit = adminSecret.trim().length > 0 && seatLabels.length > 0;

  async function submit(action: AdminAction) {
    if (!canSubmit) {
      setError("Enter the admin secret and at least one seat label.");
      return;
    }

    setSubmittingAction(action);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/tickets/admin/block", {
        body: JSON.stringify({
          actorLabel: actorLabel.trim() || "Admin Override",
          notes: notes.trim(),
          seatLabels,
        }),
        headers: buildAdminRequestHeaders(adminSecret, {
          "content-type": "application/json",
        }),
        method: action === "block" ? "POST" : "DELETE",
      });

      const payload = (await response.json()) as ActionResult;

      if (!response.ok) {
        throw new Error(payload.message || "Admin seat action failed.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Admin seat action failed.");
    } finally {
      setSubmittingAction("");
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        Use the visible seat IDs from the map, such as `SA1-1`, `SB1-8`, `LW13-2`, or `RW14-1`.
        The admin secret is only sent with this request and is not stored on the page.
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
          <span>Blockout Reason</span>
          <input
            className={styles.textInput}
            onChange={(event) => setActorLabel(event.target.value)}
            placeholder="Enter preview / peak note"
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
          placeholder="SB1-5, SB1-6, SB1-7, SB1-8"
          rows={5}
          value={seatLabelInput}
        />
      </label>

      <label className={styles.field}>
        <span>Additional Notes</span>
        <textarea
          className={styles.textArea}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Sponsor blackout before live payments"
          rows={3}
          value={notes}
        />
      </label>

      <div className={styles.adminActionRow}>
        <button
          className={styles.primaryButton}
          disabled={!canSubmit || Boolean(submittingAction)}
          onClick={() => submit("block")}
          type="button"
        >
          {submittingAction === "block" ? "Blocking Seats..." : "Block Seats"}
        </button>

        <button
          className={styles.secondaryButton}
          disabled={!canSubmit || Boolean(submittingAction)}
          onClick={() => submit("unblock")}
          type="button"
        >
          {submittingAction === "unblock" ? "Unblocking Seats..." : "Unblock Seats"}
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
          <div className={styles.paymentStatusLabel}>Last Response</div>
          <pre className={styles.adminResult}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
