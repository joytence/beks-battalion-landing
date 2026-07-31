"use client";

import { useEffect, useMemo, useState } from "react";
import { adminInputProps, adminTextAreaProps } from "./adminFormProps";
import { buildAdminRequestHeaders } from "./adminRequestHeaders";
import styles from "../ticketing.module.css";

type IssueResult = {
  autoBlockedSeatLabels?: string[];
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

type AvailableSeat = {
  blockLabel: string;
  label: string;
  layoutLabel: string;
  row: string;
  tierId: string;
  tierName: string;
};

type AvailabilityResult = {
  availableSeats: AvailableSeat[];
  blockedSeats: AvailableSeat[];
  generatedAt: string;
  message?: string;
  summary: {
    availableByTier: {
      count: number;
      tierId: string;
      tierName: string;
    }[];
    blockedByTier: {
      count: number;
      tierId: string;
      tierName: string;
    }[];
    totalAvailable: number;
    totalBlocked: number;
  };
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

function formatGeneratedAt(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminIssueTools() {
  const [autoBlockOpenSeats, setAutoBlockOpenSeats] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySearch, setAvailabilitySearch] = useState("");
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
  const selectedSeatSet = useMemo(() => new Set(seatLabels), [seatLabels]);
  const manualTextMessage = useMemo(() => buildManualTextMessage(result), [result]);
  const manualTextHref = useMemo(
    () => buildSmsHref(result?.purchaserPhone || purchaserPhone, manualTextMessage),
    [manualTextMessage, purchaserPhone, result?.purchaserPhone],
  );
  const canSubmit = purchaserName.trim().length > 0 && seatLabels.length > 0;

  const filteredAvailableSeats = useMemo(() => {
    const searchTerm = availabilitySearch.trim().toLowerCase();

    return (availability?.availableSeats || []).filter((seat) => {
      if (!searchTerm) {
        return true;
      }

      return [seat.label, seat.layoutLabel, seat.row, seat.blockLabel, seat.tierName]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [availability?.availableSeats, availabilitySearch]);

  const filteredBlockedSeats = useMemo(() => {
    const searchTerm = availabilitySearch.trim().toLowerCase();

    return (availability?.blockedSeats || []).filter((seat) => {
      if (!searchTerm) {
        return true;
      }

      return [seat.label, seat.layoutLabel, seat.row, seat.blockLabel, seat.tierName]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [availability?.blockedSeats, availabilitySearch]);

  const availableSeatsByTier = useMemo(() => {
    const groups = new Map<string, { count: number; seats: AvailableSeat[]; tierName: string }>();

    for (const seat of filteredAvailableSeats) {
      const current = groups.get(seat.tierId);

      if (current) {
        current.count += 1;
        current.seats.push(seat);
        continue;
      }

      groups.set(seat.tierId, {
        count: 1,
        seats: [seat],
        tierName: seat.tierName,
      });
    }

    return Array.from(groups.entries()).map(([tierId, value]) => ({
      count: value.count,
      seats: value.seats,
      tierId,
      tierName: value.tierName,
    }));
  }, [filteredAvailableSeats]);

  const blockedSeatsByTier = useMemo(() => {
    const groups = new Map<string, { count: number; seats: AvailableSeat[]; tierName: string }>();

    for (const seat of filteredBlockedSeats) {
      const current = groups.get(seat.tierId);

      if (current) {
        current.count += 1;
        current.seats.push(seat);
        continue;
      }

      groups.set(seat.tierId, {
        count: 1,
        seats: [seat],
        tierName: seat.tierName,
      });
    }

    return Array.from(groups.entries()).map(([tierId, value]) => ({
      count: value.count,
      seats: value.seats,
      tierId,
      tierName: value.tierName,
    }));
  }, [filteredBlockedSeats]);

  useEffect(() => {
    void loadAvailability();
  }, []);

  async function loadAvailability() {
    setAvailabilityLoading(true);
    setAvailabilityError("");

    try {
      const response = await fetch("/api/tickets/admin/issue-availability", {
        cache: "no-store",
        headers: buildAdminRequestHeaders(),
      });
      const payload = await readResponsePayload<AvailabilityResult>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Open seat lookup failed.");
      }

      setAvailability(payload);
    } catch (caughtError) {
      setAvailabilityError(caughtError instanceof Error ? caughtError.message : "Open seat lookup failed.");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  function toggleSeatLabel(seatLabel: string) {
    const nextSeatLabels = normalizeSeatLabels(seatLabelInput);
    const nextSeatSet = new Set(nextSeatLabels);

    if (nextSeatSet.has(seatLabel)) {
      nextSeatSet.delete(seatLabel);
    } else {
      nextSeatSet.add(seatLabel);
    }

    setSeatLabelInput(Array.from(nextSeatSet).join(", "));
  }

  async function submit() {
    if (!canSubmit) {
      setError("Enter the recipient name and at least one seat.");
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
          autoBlockOpenSeats,
          notes: notes.trim(),
          purchaserEmail: purchaserEmail.trim(),
          purchaserName: purchaserName.trim(),
          purchaserPhone: purchaserPhone.trim(),
          seatLabels,
        }),
        headers: buildAdminRequestHeaders({
          "content-type": "application/json",
        }),
        method: "POST",
      });

      const payload = await readResponsePayload<IssueResult>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Admin ticket issue failed.");
      }

      setResult(payload);
      await loadAvailability();
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

    setSendingText(true);
    setError("");
    setTextStatus("");

    try {
      const response = await fetch("/api/tickets/admin/text-issued", {
        body: JSON.stringify({
          orderId: result.orderId,
          recipientPhone: purchaserPhone.trim(),
        }),
        headers: buildAdminRequestHeaders({
          "content-type": "application/json",
        }),
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

    setSendingEmail(true);
    setError("");
    setEmailStatus("");

    try {
      const response = await fetch("/api/tickets/admin/email-issued", {
        body: JSON.stringify({
          orderId: result.orderId,
          recipientEmail: purchaserEmail.trim(),
        }),
        headers: buildAdminRequestHeaders({
          "content-type": "application/json",
        }),
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
        Use blocked seats if they are already reserved, or turn on auto-block mode to issue open
        seats in one step. The lists below now show both open seats and blocked seats that are
        ready to be assigned to a specific guest.
      </div>

      <div className={styles.paymentStatusBox}>
        <div className={styles.paymentStatusLabel}>Issue Seat Pools</div>
        <div className={styles.adminActionRow}>
          <button
            className={styles.secondaryButton}
            disabled={availabilityLoading}
            onClick={() => void loadAvailability()}
            type="button"
          >
            {availabilityLoading ? "Refreshing Open Seats..." : "Refresh Open Seats"}
          </button>
        </div>
        {availability ? (
          <>
            <div className={styles.seatDatabaseSummaryGrid}>
              <div>
                <span>Total Open Seats</span>
                <strong>{availability.summary.totalAvailable}</strong>
              </div>
              <div>
                <span>Total Blocked Seats</span>
                <strong>{availability.summary.totalBlocked}</strong>
              </div>
              {availability.summary.availableByTier.map((tier) => (
                <div key={tier.tierId}>
                  <span>{tier.tierName} Open</span>
                  <strong>{tier.count}</strong>
                </div>
              ))}
              {availability.summary.blockedByTier.map((tier) => (
                <div key={`blocked-${tier.tierId}`}>
                  <span>{tier.tierName} Blocked</span>
                  <strong>{tier.count}</strong>
                </div>
              ))}
            </div>
            <div className={styles.notice}>Last refreshed {formatGeneratedAt(availability.generatedAt)}</div>
          </>
        ) : null}
        <label className={styles.field}>
          <span>Search Open Or Blocked Seats</span>
          <input
            {...adminInputProps}
            className={styles.textInput}
            onChange={(event) => setAvailabilitySearch(event.target.value)}
            placeholder="Search by seat, row, section, or tier"
            type="text"
            value={availabilitySearch}
          />
        </label>
        {availabilityError ? <div className={styles.error}>{availabilityError}</div> : null}
        {availableSeatsByTier.length > 0 ? (
          <div className={styles.openSeatTierStack}>
            {availableSeatsByTier.map((tier) => (
              <div className={styles.openSeatTierCard} key={tier.tierId}>
                <div className={styles.openSeatTierHeader}>
                  <strong>{tier.tierName}</strong>
                  <span>{tier.count} open</span>
                </div>
                <div className={styles.openSeatChipGrid}>
                  {tier.seats.map((seat) => (
                    <button
                      className={`${styles.openSeatChip} ${selectedSeatSet.has(seat.label) ? styles.openSeatChipSelected : ""}`}
                      key={seat.label}
                      onClick={() => toggleSeatLabel(seat.label)}
                      type="button"
                    >
                      <strong>{seat.label}</strong>
                      <span>
                        {seat.blockLabel} • Row {seat.row}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {blockedSeatsByTier.length > 0 ? (
          <div className={styles.openSeatTierStack}>
            {blockedSeatsByTier.map((tier) => (
              <div className={styles.openSeatTierCard} key={`blocked-${tier.tierId}`}>
                <div className={styles.openSeatTierHeader}>
                  <strong>{tier.tierName}</strong>
                  <span>{tier.count} blocked and ready</span>
                </div>
                <div className={styles.openSeatChipGrid}>
                  {tier.seats.map((seat) => (
                    <button
                      className={`${styles.openSeatChip} ${selectedSeatSet.has(seat.label) ? styles.openSeatChipSelected : ""}`}
                      key={`blocked-${seat.label}`}
                      onClick={() => toggleSeatLabel(seat.label)}
                      type="button"
                    >
                      <strong>{seat.label}</strong>
                      <span>
                        {seat.blockLabel} • Row {seat.row}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {availability && !availabilityLoading && availableSeatsByTier.length < 1 && blockedSeatsByTier.length < 1 ? (
          <div className={styles.notice}>No seats matched the current search.</div>
        ) : null}
      </div>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Blockout Reason</span>
          <input
            {...adminInputProps}
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
            {...adminInputProps}
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
            {...adminInputProps}
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
            {...adminInputProps}
            className={styles.textInput}
            onChange={(event) => setPurchaserPhone(event.target.value)}
            placeholder="Optional phone number"
            type="text"
            value={purchaserPhone}
          />
        </label>
      </div>

      <label className={styles.checkboxField}>
        <input
          checked={autoBlockOpenSeats}
          onChange={(event) => setAutoBlockOpenSeats(event.target.checked)}
          type="checkbox"
        />
        <span>
          Auto-block open seats during issue so I do not have to block them separately first.
        </span>
      </label>

      <label className={styles.field}>
        <span>Actual Visible Seat IDs From Map</span>
        <textarea
          {...adminTextAreaProps}
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
          {...adminTextAreaProps}
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
          {submitting
            ? "Issuing Tickets..."
            : autoBlockOpenSeats
              ? "Issue And Auto-Block Tickets"
              : "Issue QR Tickets"}
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
                {...adminTextAreaProps}
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
