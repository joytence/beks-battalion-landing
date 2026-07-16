"use client";

import { useMemo, useState } from "react";
import styles from "../ticketing.module.css";

type IssueResult = {
  checkoutSessionId: string;
  issuedSeatLabels: string[];
  message?: string;
  orderId: string;
  purchaserEmail?: string;
  purchaserName: string;
  purchaserPhone?: string;
  receiptUrl: string;
  secureReceiptUrl?: string;
  ticketTierId: string;
};

type EmailResult = {
  message?: string;
  purchaserEmail?: string;
  receiptUrl?: string;
  seats?: string[];
};

type TextResult = {
  message?: string;
  purchaserPhone?: string;
  receiptUrl?: string;
  seats?: string[];
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

function getAbsoluteReceiptUrl(receiptUrl: string) {
  if (!receiptUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(receiptUrl)) {
    return receiptUrl;
  }

  if (typeof window === "undefined") {
    return receiptUrl;
  }

  return new URL(receiptUrl, window.location.origin).toString();
}

function buildManualTextMessage(result: IssueResult | null) {
  if (!result) {
    return "";
  }

  const receiptUrl = getAbsoluteReceiptUrl(result.secureReceiptUrl || result.receiptUrl);
  const seats = result.issuedSeatLabels.length > 0 ? result.issuedSeatLabels.join(", ") : "your assigned seats";

  return [
    `Hi ${result.purchaserName}, your Joy Stage Productions ticket pass is ready.`,
    `Seats: ${seats}`,
    `Open or print your tickets here: ${receiptUrl}`,
    "Please show the QR code at entry.",
  ].join("\n");
}

function buildSmsHref(phone: string, message: string) {
  const normalizedPhone = phone.replace(/[^\d+]/g, "");
  const recipient = normalizedPhone ? encodeURIComponent(normalizedPhone) : "";
  return `sms:${recipient}?&body=${encodeURIComponent(message)}`;
}

export function AdminIssueTools() {
  const [adminSecret, setAdminSecret] = useState("");
  const [blockoutReason, setBlockoutReason] = useState("");
  const [notes, setNotes] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserPhone, setPurchaserPhone] = useState("");
  const [seatLabelInput, setSeatLabelInput] = useState("");
  const [result, setResult] = useState<IssueResult | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [textStatus, setTextStatus] = useState("");
  const [error, setError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingText, setSendingText] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const seatLabels = useMemo(() => normalizeSeatLabels(seatLabelInput), [seatLabelInput]);
  const manualTextMessage = useMemo(() => buildManualTextMessage(result), [result]);
  const manualTextHref = useMemo(
    () => buildSmsHref(result?.purchaserPhone || purchaserPhone, manualTextMessage),
    [manualTextMessage, purchaserPhone, result?.purchaserPhone],
  );
  const canSubmit =
    adminSecret.trim().length > 0 && purchaserName.trim().length > 0 && seatLabels.length > 0;

  async function submit() {
    if (!canSubmit) {
      setError("Enter the admin secret, recipient name, and at least one blocked seat.");
      return;
    }

    setSubmitting(true);
    setError("");
    setCopyStatus("");
    setEmailStatus("");
    setTextStatus("");
    setResult(null);

    try {
      const response = await fetch("/api/tickets/admin/issue", {
        body: JSON.stringify({
          actorLabel: blockoutReason.trim() || "Admin Issue",
          notes: notes.trim(),
          purchaserEmail: purchaserEmail.trim(),
          purchaserName: purchaserName.trim(),
          purchaserPhone: purchaserPhone.trim(),
          seatLabels,
        }),
        headers: {
          authorization: `Bearer ${adminSecret.trim()}`,
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = await readResponsePayload<IssueResult>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Admin ticket issue failed.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Admin ticket issue failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendText() {
    if (!result) {
      return;
    }

    if (!adminSecret.trim()) {
      setError("Enter the admin secret before sending the text.");
      return;
    }

    setSendingText(true);
    setError("");
    setTextStatus("");

    try {
      const response = await fetch("/api/tickets/admin/text-issued", {
        body: JSON.stringify({
          orderId: result.orderId,
          recipientPhone: purchaserPhone.trim(),
        }),
        headers: {
          authorization: `Bearer ${adminSecret.trim()}`,
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = await readResponsePayload<TextResult>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Ticket text could not be sent.");
      }

      setTextStatus(payload.message || "Ticket text sent.");
      setResult((currentResult) =>
        currentResult
          ? {
              ...currentResult,
              purchaserPhone: payload.purchaserPhone || purchaserPhone.trim() || currentResult.purchaserPhone,
            }
          : currentResult,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ticket text could not be sent.");
    } finally {
      setSendingText(false);
    }
  }

  async function copyManualText() {
    if (!manualTextMessage) {
      return;
    }

    setCopyStatus("");

    try {
      await navigator.clipboard.writeText(manualTextMessage);
      setCopyStatus("Ticket text copied.");
    } catch {
      setCopyStatus("Copy failed. Select and copy the message manually.");
    }
  }

  async function sendEmail() {
    if (!result) {
      return;
    }

    if (!adminSecret.trim()) {
      setError("Enter the admin secret before sending the email.");
      return;
    }

    setSendingEmail(true);
    setError("");
    setEmailStatus("");

    try {
      const response = await fetch("/api/tickets/admin/email-issued", {
        body: JSON.stringify({
          orderId: result.orderId,
          recipientEmail: purchaserEmail.trim(),
        }),
        headers: {
          authorization: `Bearer ${adminSecret.trim()}`,
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = await readResponsePayload<EmailResult>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Ticket email could not be sent.");
      }

      setEmailStatus(payload.message || "Ticket email sent.");
      setResult((currentResult) =>
        currentResult
          ? {
              ...currentResult,
              purchaserEmail: payload.purchaserEmail || purchaserEmail.trim() || currentResult.purchaserEmail,
            }
          : currentResult,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Ticket email could not be sent.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        Issue this only after the seats are already blocked. This generates printable QR tickets
        without Stripe checkout and keeps those seats unavailable in the venue map.
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
            onChange={(event) => setBlockoutReason(event.target.value)}
            placeholder="Sponsor, family hold, comp guest"
            type="text"
            value={blockoutReason}
          />
        </label>
      </div>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Recipient Name</span>
          <input
            className={styles.textInput}
            onChange={(event) => setPurchaserName(event.target.value)}
            placeholder="Enter guest or sponsor name"
            type="text"
            value={purchaserName}
          />
        </label>

        <label className={styles.field}>
          <span>Recipient Email</span>
          <input
            className={styles.textInput}
            onChange={(event) => setPurchaserEmail(event.target.value)}
            placeholder="Optional email for recordkeeping"
            type="email"
            value={purchaserEmail}
          />
        </label>
      </div>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Recipient Phone</span>
          <input
            className={styles.textInput}
            onChange={(event) => setPurchaserPhone(event.target.value)}
            placeholder="Optional phone number"
            type="text"
            value={purchaserPhone}
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
          placeholder="Sponsor admission, comps, or delivery notes"
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
          {submitting ? "Issuing Tickets..." : "Issue QR Tickets"}
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
          <div className={styles.paymentStatusLabel}>Issued Result</div>
          {result.message ? <div className={styles.notice}>{result.message}</div> : null}
          <pre className={styles.adminResult}>{JSON.stringify(result, null, 2)}</pre>
          {manualTextMessage ? (
            <div className={styles.notice}>
              <strong>Manual text message</strong>
              <textarea
                className={styles.textArea}
                readOnly
                rows={6}
                value={manualTextMessage}
              />
              <div className={styles.adminActionRow}>
                <button
                  className={styles.secondaryButton}
                  onClick={copyManualText}
                  type="button"
                >
                  Copy Text Message
                </button>
                <a className={styles.primaryButton} href={manualTextHref}>
                  Open SMS App
                </a>
              </div>
              {copyStatus ? <div className={styles.notice}>{copyStatus}</div> : null}
            </div>
          ) : null}
          <div className={styles.adminActionRow}>
            <a className={styles.secondaryButton} href={result.receiptUrl}>
              Open Printable Tickets
            </a>
            {result.purchaserEmail ? (
              <button
                className={styles.primaryButton}
                disabled={sendingEmail}
                onClick={sendEmail}
                type="button"
              >
                {sendingEmail ? "Sending Email..." : "Send Email To Recipient"}
              </button>
            ) : null}
            {(result.purchaserPhone || purchaserPhone.trim()) ? (
              <button
                className={styles.secondaryButton}
                disabled={sendingText}
                onClick={sendText}
                type="button"
              >
                {sendingText ? "Sending Text..." : "Send Text To Recipient"}
              </button>
            ) : null}
          </div>
          {!result.purchaserEmail ? (
            <div className={styles.notice}>
              No recipient email was saved for this issued order, so the secure pass link cannot be
              emailed yet.
            </div>
          ) : null}
          {!result.purchaserPhone && !purchaserPhone.trim() ? (
            <div className={styles.notice}>
              No recipient phone number was saved for this issued order, so the secure pass link
              cannot be texted yet.
            </div>
          ) : null}
          {emailStatus ? <div className={styles.notice}>{emailStatus}</div> : null}
          {textStatus ? <div className={styles.notice}>{textStatus}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
