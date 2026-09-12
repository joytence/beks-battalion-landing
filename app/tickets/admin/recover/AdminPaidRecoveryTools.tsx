"use client";

import { useState } from "react";
import { adminInputProps } from "../adminFormProps";
import { buildAdminRequestHeaders } from "../adminRequestHeaders";
import styles from "../../ticketing.module.css";

type RecoveryTicket = {
  id: string;
  originalSeatLabel: string;
  seatLabel: string;
  ticketIndex: number;
  ticketStatus: string;
};

type RecoveryOrder = {
  amountTotal: number;
  checkoutSessionId: string;
  createdAt: string;
  currency: string;
  id: string;
  orderStatus: string;
  paidAt: string | null;
  purchaserEmail: string;
  purchaserName: string;
  purchaserPhone: string;
  receiptUrl: string;
  seatAssignmentMode: string;
  ticketQuantity: number;
  ticketTierId: string;
  tickets: RecoveryTicket[];
  updatedAt: string;
};

type RecoveryResponse = {
  generatedAt?: string;
  message?: string;
  orders?: RecoveryOrder[];
};

type PaidTicketActionResponse = {
  message?: string;
  purchaserEmail?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  receiptUrl?: string;
  transferCheckoutSessionId?: string;
};

type ContactDrafts = Record<
  string,
  {
    email: string;
    name: string;
    phone: string;
  }
>;

type TransferDrafts = Record<
  string,
  {
    email: string;
    name: string;
    phone: string;
    seatLabels: string[];
  }
>;

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(amountTotal: number, currency: string) {
  if (typeof amountTotal !== "number") {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    currency: currency || "usd",
    style: "currency",
  }).format(amountTotal / 100);
}

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

function buildContactDrafts(orders: RecoveryOrder[]) {
  return orders.reduce<ContactDrafts>((drafts, order) => {
    drafts[order.checkoutSessionId] = {
      email: order.purchaserEmail || "",
      name: order.purchaserName || "",
      phone: order.purchaserPhone || "",
    };
    return drafts;
  }, {});
}

function buildTransferDrafts(orders: RecoveryOrder[]) {
  return orders.reduce<TransferDrafts>((drafts, order) => {
    drafts[order.checkoutSessionId] = { email: "", name: "", phone: "", seatLabels: [] };
    return drafts;
  }, {});
}

function isAdminIssuedOrder(order: RecoveryOrder) {
  return order.checkoutSessionId.startsWith("admin_issued_");
}

export function AdminPaidRecoveryTools() {
  const [error, setError] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<RecoveryOrder[]>([]);
  const [status, setStatus] = useState("");
  const [processingActionKey, setProcessingActionKey] = useState("");
  const [contactDrafts, setContactDrafts] = useState<ContactDrafts>({});
  const [transferDrafts, setTransferDrafts] = useState<TransferDrafts>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});

  async function loadOrders(options: { query?: string; recent?: boolean }) {
    setLoading(true);
    setError("");
    setStatus("");
    setActionMessages({});

    try {
      const response = await fetch("/api/tickets/admin/recover-paid", {
        body: JSON.stringify({
          limit: options.recent ? 8 : 12,
          query: options.query || "",
          recent: options.recent === true,
        }),
        headers: buildAdminRequestHeaders({
          "content-type": "application/json",
        }),
        method: "POST",
      });

      const payload = await readResponsePayload<RecoveryResponse>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Paid ticket recovery lookup failed.");
      }

      const nextOrders = payload.orders || [];
      setOrders(nextOrders);
      setContactDrafts(buildContactDrafts(nextOrders));
      setTransferDrafts(buildTransferDrafts(nextOrders));
      setStatus(payload.message || "");
    } catch (caughtError) {
      setOrders([]);
      setContactDrafts({});
      setTransferDrafts({});
      setError(
        caughtError instanceof Error ? caughtError.message : "Paid ticket recovery lookup failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(checkoutSessionId: string, field: "email" | "name" | "phone", value: string) {
    setContactDrafts((current) => ({
      ...current,
      [checkoutSessionId]: {
        email: current[checkoutSessionId]?.email || "",
        name: current[checkoutSessionId]?.name || "",
        phone: current[checkoutSessionId]?.phone || "",
        [field]: value,
      },
    }));
  }

  function updateOrderContacts(
    checkoutSessionId: string,
    updates: {
      purchaserEmail?: string;
      purchaserName?: string;
      purchaserPhone?: string;
    },
  ) {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.checkoutSessionId === checkoutSessionId
          ? {
              ...order,
              ...(updates.purchaserEmail ? { purchaserEmail: updates.purchaserEmail } : {}),
              ...(updates.purchaserName ? { purchaserName: updates.purchaserName } : {}),
              ...(updates.purchaserPhone ? { purchaserPhone: updates.purchaserPhone } : {}),
            }
          : order,
      ),
    );

    setContactDrafts((current) => ({
      ...current,
      [checkoutSessionId]: {
        email: updates.purchaserEmail ?? current[checkoutSessionId]?.email ?? "",
        name: updates.purchaserName ?? current[checkoutSessionId]?.name ?? "",
        phone: updates.purchaserPhone ?? current[checkoutSessionId]?.phone ?? "",
      },
    }));
  }

  function updateTransferDraft(
    checkoutSessionId: string,
    field: "email" | "name" | "phone",
    value: string,
  ) {
    setTransferDrafts((current) => ({
      ...current,
      [checkoutSessionId]: {
        email: current[checkoutSessionId]?.email || "",
        name: current[checkoutSessionId]?.name || "",
        phone: current[checkoutSessionId]?.phone || "",
        seatLabels: current[checkoutSessionId]?.seatLabels || [],
        [field]: value,
      },
    }));
  }

  function toggleTransferSeat(checkoutSessionId: string, seatLabel: string) {
    setTransferDrafts((current) => {
      const draft = current[checkoutSessionId] || { email: "", name: "", phone: "", seatLabels: [] };
      const selected = new Set(draft.seatLabels);
      if (selected.has(seatLabel)) {
        selected.delete(seatLabel);
      } else {
        selected.add(seatLabel);
      }
      return { ...current, [checkoutSessionId]: { ...draft, seatLabels: Array.from(selected) } };
    });
  }

  async function resend(order: RecoveryOrder, channel: "email" | "text") {
    const checkoutSessionId = order.checkoutSessionId;
    const draft = contactDrafts[checkoutSessionId] || {
      email: order.purchaserEmail || "",
      name: order.purchaserName || "",
      phone: order.purchaserPhone || "",
    };

    setProcessingActionKey(`${checkoutSessionId}:${channel}`);
    setError("");
    setActionMessages((current) => ({
      ...current,
      [checkoutSessionId]: "",
    }));

    try {
      const adminIssued = isAdminIssuedOrder(order);
      const endpoint = adminIssued
        ? channel === "email"
          ? "/api/tickets/admin/email-issued"
          : "/api/tickets/admin/text-issued"
        : "/api/tickets/admin/resend-paid";
      const body = adminIssued
        ? channel === "email"
          ? {
              orderId: order.id,
              recipientEmail: draft.email.trim(),
            }
          : {
              orderId: order.id,
              recipientPhone: draft.phone.trim(),
            }
        : {
            channel,
            checkoutSessionId,
            recipientEmail: draft.email.trim(),
            recipientPhone: draft.phone.trim(),
          };

      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: buildAdminRequestHeaders({
          "content-type": "application/json",
        }),
        method: "POST",
      });

      const payload = await readResponsePayload<PaidTicketActionResponse>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Paid ticket resend failed.");
      }

      updateOrderContacts(checkoutSessionId, {
        purchaserEmail: payload.purchaserEmail,
        purchaserName: payload.purchaserName,
        purchaserPhone: payload.purchaserPhone,
      });
      setActionMessages((current) => ({
        ...current,
        [checkoutSessionId]: payload.message || "Paid ticket resent.",
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Paid ticket resend failed.");
    } finally {
      setProcessingActionKey("");
    }
  }

  async function transfer(order: RecoveryOrder) {
    const checkoutSessionId = order.checkoutSessionId;
    const draft = transferDrafts[checkoutSessionId] || { email: "", name: "", phone: "", seatLabels: [] };

    if (!window.confirm(`Transfer ${draft.seatLabels.join(", ")} to ${draft.name || "the new recipient"}? Only those ticket links and QR codes will be replaced. The Stripe payment will not be changed.`)) {
      return;
    }

    setProcessingActionKey(`${checkoutSessionId}:transfer`);
    setError("");
    setActionMessages((current) => ({ ...current, [checkoutSessionId]: "" }));

    try {
      const response = await fetch("/api/tickets/admin/transfer-paid", {
        body: JSON.stringify({
          checkoutSessionId,
          purchaserEmail: draft.email.trim(),
          purchaserName: draft.name.trim(),
          purchaserPhone: draft.phone.trim(),
          seatLabels: draft.seatLabels,
        }),
        headers: buildAdminRequestHeaders({ "content-type": "application/json" }),
        method: "POST",
      });
      const payload = await readResponsePayload<PaidTicketActionResponse>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Paid ticket transfer failed.");
      }

      setLookupQuery(payload.transferCheckoutSessionId || "");
      await loadOrders({ query: payload.transferCheckoutSessionId || "" });
      setStatus(`${payload.message || "Paid ticket transferred."} Send the replacement ticket using Email or Text.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Paid ticket transfer failed.");
    } finally {
      setProcessingActionKey("");
    }
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        Use this recovery page when you need to reopen, re-email, or re-text a real paid Stripe
        ticket without loading the full seat database screen.
      </div>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Find Tickets By Name, Seat, or Contact</span>
          <input
            {...adminInputProps}
            className={styles.textInput}
            onChange={(event) => setLookupQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && lookupQuery.trim() && !loading) {
                event.preventDefault();
                void loadOrders({ query: lookupQuery.trim() });
              }
            }}
            placeholder="Enter any part of the purchaser's name, a seat, email, or phone"
            type="text"
            value={lookupQuery}
          />
        </label>
      </div>

      <div className={styles.notice}>
        Search by a purchaser&apos;s full or partial name to find all of their current active tickets.
      </div>

      <div className={styles.adminActionRow}>
        <button
          className={styles.primaryButton}
          disabled={loading || !lookupQuery.trim()}
          onClick={() => loadOrders({ query: lookupQuery.trim() })}
          type="button"
        >
          {loading ? "Loading..." : "Find Paid Ticket"}
        </button>
        <button
          className={styles.secondaryButton}
          disabled={loading}
          onClick={() => loadOrders({ recent: true })}
          type="button"
        >
          {loading ? "Loading..." : "Load Recent Paid Tickets"}
        </button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {status ? <div className={styles.notice}>{status}</div> : null}

      {orders.map((order) => {
        const draft = contactDrafts[order.checkoutSessionId] || {
          email: order.purchaserEmail || "",
          name: order.purchaserName || "",
          phone: order.purchaserPhone || "",
        };
        const transferDraft = transferDrafts[order.checkoutSessionId] || {
          email: "",
          name: "",
          phone: "",
          seatLabels: [],
        };
        const seatList = order.tickets.map((ticket) => ticket.seatLabel).join(", ");
        const emailKey = `${order.checkoutSessionId}:email`;
        const textKey = `${order.checkoutSessionId}:text`;
        const transferKey = `${order.checkoutSessionId}:transfer`;

        return (
          <div className={styles.paymentStatusBox} key={order.checkoutSessionId}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionEyebrow}>Paid Order Recovery</div>
              <h3 className={styles.seatMapTitle}>
                {order.purchaserName || "Paid Ticket Order"} {seatList ? `• ${seatList}` : ""}
              </h3>
            </div>

            <div className={styles.ticketMeta}>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Order ID</span>
                <div className={styles.ticketCode}>{order.id}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Checkout Session</span>
                <div className={styles.ticketCode}>{order.checkoutSessionId}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Seats</span>
                <div>{seatList || "No active tickets found"}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Tier</span>
                <div>{order.ticketTierId}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Amount</span>
                <div>{formatMoney(order.amountTotal, order.currency)}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Paid At</span>
                <div>{formatDate(order.paidAt)}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Email On File</span>
                <div>{order.purchaserEmail || "None saved"}</div>
              </div>
              <div className={styles.ticketMetaItem}>
                <span className={styles.ticketLabel}>Phone On File</span>
                <div>{order.purchaserPhone || "None saved"}</div>
              </div>
            </div>

            <div className={styles.notice}>
              <strong>1. Update Existing Ticket Delivery</strong>
              <br />Use these fields only to add or correct the current ticket holder&apos;s contact, then resend their existing ticket.
            </div>

            <div className={styles.adminFormGrid}>
              <label className={styles.field}>
                <span>Existing Ticket Email</span>
                <input
                  {...adminInputProps}
                  className={styles.textInput}
                  onChange={(event) => updateDraft(order.checkoutSessionId, "email", event.target.value)}
                  placeholder="recipient@example.com"
                  type="email"
                  value={draft.email}
                />
              </label>
              <label className={styles.field}>
                <span>Existing Ticket Phone</span>
                <input
                  {...adminInputProps}
                  className={styles.textInput}
                  onChange={(event) => updateDraft(order.checkoutSessionId, "phone", event.target.value)}
                  placeholder="+1 555 555 5555"
                  type="text"
                  value={draft.phone}
                />
              </label>
            </div>

            <div className={styles.adminActionRow}>
              <a className={styles.secondaryButton} href={order.receiptUrl}>
                Open Existing Ticket
              </a>
              <button
                className={styles.primaryButton}
                disabled={processingActionKey === emailKey}
                onClick={() => resend(order, "email")}
                type="button"
              >
                {processingActionKey === emailKey ? "Sending Email..." : "Resend Existing Email"}
              </button>
              <button
                className={styles.secondaryButton}
                disabled={processingActionKey === textKey}
                onClick={() => resend(order, "text")}
                type="button"
              >
                {processingActionKey === textKey ? "Sending Text..." : "Resend Existing Text"}
              </button>
            </div>

            <div className={styles.notice}>
              <strong>2. Reassign Selected Seats To A New Recipient</strong>
              <br />This creates replacement tickets for only the checked seats. It does not refund or change the Stripe payment.
            </div>

            <div className={styles.adminFormGrid}>
              <label className={styles.field}>
                <span>New Recipient Name</span>
                <input
                  {...adminInputProps}
                  className={styles.textInput}
                  onChange={(event) => updateTransferDraft(order.checkoutSessionId, "name", event.target.value)}
                  placeholder="Recipient name"
                  type="text"
                  value={transferDraft.name}
                />
              </label>
              <label className={styles.field}>
                <span>New Recipient Email</span>
                <input
                  {...adminInputProps}
                  className={styles.textInput}
                  onChange={(event) => updateTransferDraft(order.checkoutSessionId, "email", event.target.value)}
                  placeholder="recipient@example.com"
                  type="email"
                  value={transferDraft.email}
                />
              </label>

              <label className={styles.field}>
                <span>New Recipient Phone</span>
                <input
                  {...adminInputProps}
                  className={styles.textInput}
                  onChange={(event) => updateTransferDraft(order.checkoutSessionId, "phone", event.target.value)}
                  placeholder="+1 555 555 5555"
                  type="text"
                  value={transferDraft.phone}
                />
              </label>
            </div>

            <div className={styles.notice}>
              <strong>Select only the seats to transfer:</strong>{" "}
              {order.tickets.map((ticket) => (
                <label key={ticket.id} style={{ marginLeft: "12px" }}>
                  <input
                    checked={transferDraft.seatLabels.includes(ticket.seatLabel)}
                    onChange={() => toggleTransferSeat(order.checkoutSessionId, ticket.seatLabel)}
                    type="checkbox"
                  /> {ticket.seatLabel}
                </label>
              ))}
            </div>

            <div className={styles.adminActionRow}>
              <button
                className={styles.secondaryButton}
                disabled={processingActionKey === transferKey || !transferDraft.name.trim() || (!transferDraft.email.trim() && !transferDraft.phone.trim()) || transferDraft.seatLabels.length < 1}
                onClick={() => transfer(order)}
                type="button"
              >
                {processingActionKey === transferKey ? "Transferring..." : "Transfer Selected Seats"}
              </button>
            </div>

            {actionMessages[order.checkoutSessionId] ? (
              <div className={styles.notice}>{actionMessages[order.checkoutSessionId]}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
