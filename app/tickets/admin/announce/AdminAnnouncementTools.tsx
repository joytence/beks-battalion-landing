"use client";

import { useEffect, useMemo, useState } from "react";
import { adminTextAreaProps } from "../adminFormProps";
import { buildAdminRequestHeaders } from "../adminRequestHeaders";
import styles from "../../ticketing.module.css";

type SendResult = {
  failedCount?: number;
  message?: string;
  sentCount?: number;
};

type DistributionList = {
  id: string;
  name: string;
  recipientPhones: string[];
};

function parseRecipients(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((phone) => phone.trim())
        .filter(Boolean),
    ),
  );
}

export function AdminAnnouncementTools() {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [distributionName, setDistributionName] = useState("");
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [listStatus, setListStatus] = useState("");
  const [savingList, setSavingList] = useState(false);
  const [sending, setSending] = useState(false);
  const recipients = useMemo(() => parseRecipients(recipientInput), [recipientInput]);
  const preview = message.trim()
    ? `Joy Stage Productions: ${message.trim()}\nReply STOP to opt out.`
    : "Your message preview will appear here.";

  async function loadDistributionLists() {
    const response = await fetch("/api/tickets/admin/announcement-lists", {
      headers: buildAdminRequestHeaders(),
    });
    const payload = (await response.json()) as { lists?: DistributionList[]; message?: string };
    if (!response.ok) throw new Error(payload.message || "Saved distributions could not be loaded.");
    setDistributionLists(payload.lists || []);
  }

  useEffect(() => {
    void loadDistributionLists().catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : "Saved distributions could not be loaded.");
    });
  }, []);

  async function saveDistributionList() {
    if (!distributionName.trim() || recipients.length < 1) {
      setError("Add a distribution name and at least one recipient before saving.");
      return;
    }

    setSavingList(true);
    setError("");
    setListStatus("");
    try {
      const response = await fetch("/api/tickets/admin/announcement-lists", {
        body: JSON.stringify({ name: distributionName.trim(), recipientPhones: recipients }),
        headers: buildAdminRequestHeaders({ "content-type": "application/json" }),
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "The distribution list could not be saved.");
      await loadDistributionLists();
      setListStatus(payload.message || "Distribution list saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The distribution list could not be saved.");
    } finally {
      setSavingList(false);
    }
  }

  async function sendAnnouncement() {
    if (!confirmed || !message.trim() || recipients.length < 1) {
      setError("Add recipients and a message, then confirm consent before sending.");
      return;
    }

    setSending(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/tickets/admin/announce", {
        body: JSON.stringify({
          confirmed,
          message: message.trim(),
          recipientPhones: recipients,
        }),
        headers: buildAdminRequestHeaders({ "content-type": "application/json" }),
        method: "POST",
      });
      const payload = (await response.json()) as SendResult;

      if (!response.ok) {
        throw new Error(payload.message || "The announcement could not be sent.");
      }

      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The announcement could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        This tool sends through the same Joy Stage Productions text sender used for ticket delivery.
        Only use it for people who agreed to receive event text messages.
      </div>

      <label className={styles.field}>
        <span>Recipient Phone Numbers</span>
        <textarea
          {...adminTextAreaProps}
          className={styles.textArea}
          onChange={(event) => setRecipientInput(event.target.value)}
          placeholder={"One number per line, or separate with commas\n619-555-0100\n+1 619 555 0101"}
          rows={8}
          value={recipientInput}
        />
      </label>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Saved Distribution</span>
          <select
            className={styles.textInput}
            defaultValue=""
            onChange={(event) => {
              const selected = distributionLists.find((list) => list.id === event.target.value);
              if (selected) {
                setRecipientInput(selected.recipientPhones.join("\n"));
                setDistributionName(selected.name);
                setListStatus(`Loaded ${selected.name}.`);
              }
            }}
          >
            <option value="">Choose a saved list</option>
            {distributionLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.recipientPhones.length})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Save This Distribution As</span>
          <input
            className={styles.textInput}
            maxLength={80}
            onChange={(event) => setDistributionName(event.target.value)}
            placeholder="VIP guests, sponsor table, staff"
            type="text"
            value={distributionName}
          />
        </label>
      </div>

      <div className={styles.adminActionRow}>
        <button
          className={styles.secondaryButton}
          disabled={savingList || !distributionName.trim() || recipients.length < 1}
          onClick={saveDistributionList}
          type="button"
        >
          {savingList ? "Saving Distribution..." : "Save Distribution"}
        </button>
      </div>

      {listStatus ? <div className={styles.notice}>{listStatus}</div> : null}

      <div className={styles.selectionSummary}>
        <div className={styles.selectionCount}>
          <span>Unique Recipients</span>
          <strong>{recipients.length}</strong>
        </div>
        <div className={styles.selectionSeats}>
          <span>Numbers Ready To Check</span>
          <strong>{recipients.length ? recipients.join(", ") : "None yet"}</strong>
        </div>
      </div>

      <label className={styles.field}>
        <span>Announcement</span>
        <textarea
          {...adminTextAreaProps}
          className={styles.textArea}
          maxLength={1200}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Example: Doors now open at 4 PM. We cannot wait to see you tonight."
          rows={5}
          value={message}
        />
      </label>

      <div className={styles.paymentStatusBox}>
        <div className={styles.paymentStatusLabel}>Text Preview</div>
        <pre className={styles.adminResult}>{preview}</pre>
      </div>

      <label className={styles.field}>
        <span>
          <input
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />{" "}
          I confirm every recipient agreed to receive this announcement by text.
        </span>
      </label>

      <div className={styles.adminActionRow}>
        <button
          className={styles.primaryButton}
          disabled={sending || !confirmed || !message.trim() || recipients.length < 1}
          onClick={sendAnnouncement}
          type="button"
        >
          {sending ? "Sending Announcement..." : `Send To ${recipients.length} Recipient${recipients.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {result ? <div className={styles.notice}>{result.message}</div> : null}
    </div>
  );
}
