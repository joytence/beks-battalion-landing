"use client";

import { useState } from "react";
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
  purchaserPhone?: string;
  receiptUrl?: string;
};

type ContactDrafts = Record<
  string,
  {
    email: string;
    phone: string;
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
      phone: order.purchaserPhone || "",
    };
    return drafts;
  }, {});
}

function getPaidTicketHref(checkoutSessionId: string) {
  return `/tickets/confirmation?session_id=${encodeURIComponent(checkoutSessionId)}`;
}

export function AdminPaidRecoveryTools() {
  const [adminSecret, setAdminSecret] = useState("");
  const [error, setError] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<RecoveryOrder[]>([]);
  const [status, setStatus] = useState("");
  const [processingActionKey, setProcessingActionKey] = useState("");
  const [contactDrafts, setContactDrafts] = useState<ContactDrafts>({});
  const [actionMessages, setActionMessages] = useState<Record<string, string>>({});

  async function loadOrders(options: { query?: string; recent?: boolean }) {
    if (!adminSecret.trim()) {
      setError("Enter the admin secret first.");
      return;
    }

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
        headers: {
          authorization: `Bearer ${adminSecret.trim()}`,
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = await readResponsePayload<RecoveryResponse>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Paid ticket recovery lookup failed.");
      }

      const nextOrders = payload.orders || [];
      setOrders(nextOrders);
      setContactDrafts(buildContactDrafts(nextOrders));
      setStatus(payload.message || "");
    } catch (caughtError) {
      setOrders([]);
      setContactDrafts({});
      setError(
        caughtError instanceof Error ? caughtError.message : "Paid ticket recovery lookup failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(checkoutSessionId: string, field: "email" | "phone", value: string) {
    setContactDrafts((current) => ({
      ...current,
      [checkoutSessionId]: {
        email: current[checkoutSessionId]?.email || "",
        phone: current[checkoutSessionId]?.phone || "",
        [field]: value,
      },
    }));
  }

  function updateOrderContacts(
    checkoutSessionId: string,
    updates: {
      purchaserEmail?: string;
      purchaserPhone?: string;
    },
  ) {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.checkoutSessionId === checkoutSessionId
          ? {
              ...order,
              ...(updates.purchaserEmail ? { purchaserEmail: updates.purchaserEmail } : {}),
              ...(updates.purchaserPhone ? { purchaserPhone: updates.purchaserPhone } : {}),
            }
          : order,
      ),
    );

    setContactDrafts((current) => ({
      ...current,
      [checkoutSessionId]: {
        email: updates.purchaserEmail ?? current[checkoutSessionId]?.email ?? "",
        phone: updates.purchaserPhone ?? current[checkoutSessionId]?.phone ?? "",
      },
    }));
  }

  async function resend(order: RecoveryOrder, channel: "email" | "text") {
    if (!adminSecret.trim()) {
      setError("Enter the admin secret first.");
      return;
    }

    const checkoutSessionId = order.checkoutSessionId;
    const draft = contactDrafts[checkoutSessionId] || {
      email: order.purchaserEmail || "",
      phone: order.purchaserPhone || "",
    };

    setProcessingActionKey(`${checkoutSessionId}:${channel}`);
    setError("");
    setActionMessages((current) => ({
      ...current,
      [checkoutSessionId]: "",
    }));

    try {
      const response = await fetch("/api/tickets/admin/resend-paid", {
        body: JSON.stringify({
          channel,
          checkoutSessionId,
          recipientEmail: draft.email.trim(),
          recipientPhone: draft.phone.trim(),
        }),
        headers: {
          authorization: `Bearer ${adminSecret.trim()}`,
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = await readResponsePayload<PaidTicketActionResponse>(response);

      if (!response.ok) {
        throw new Error(payload.message || "Paid ticket resend failed.");
      }

      updateOrderContacts(checkoutSessionId, {
        purchaserEmail: payload.purchaserEmail,
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

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        Use this recovery page when you need to reopen, re-email, or re-text a real paid Stripe
        ticket without loading the full seat database screen.
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
          <span>Paid Ticket Search</span>
          <input
            className={styles.textInput}
            onChange={(event) => setLookupQuery(event.target.value)}
            placeholder="Seat, order ID, checkout session, email, phone, or name"
            type="text"
            value={lookupQuery}
          />
        </label>
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
          phone: order.purchaserPhone || "",
        };
        const seatList = order.tickets.map((ticket) => ticket.seatLabel).join(", ");
        const emailKey = `${order.checkoutSessionId}:email`;
        const textKey = `${order.checkoutSessionId}:text`;

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

            <div className={styles.adminFormGrid}>
              <label className={styles.field}>
                <span>Recovery Email</span>
                <input
                  className={styles.textInput}
                  onChange={(event) =>
                    updateDraft(order.checkoutSessionId, "email", event.target.value)
                  }
                  placeholder="recipient@example.com"
                  type="email"
                  value={draft.email}
                />
              </label>

              <label className={styles.field}>
                <span>Recovery Phone</span>
                <input
                  className={styles.textInput}
                  onChange={(event) =>
                    updateDraft(order.checkoutSessionId, "phone", event.target.value)
                  }
                  placeholder="+1 555 555 5555"
                  type="text"
                  value={draft.phone}
                />
              </label>
            </div>

            <div className={styles.adminActionRow}>
              <a className={styles.secondaryButton} href={getPaidTicketHref(order.checkoutSessionId)}>
                Open Printable Ticket
              </a>
              <button
                className={styles.primaryButton}
                disabled={processingActionKey === emailKey}
                onClick={() => resend(order, "email")}
                type="button"
              >
                {processingActionKey === emailKey ? "Sending Email..." : "Resend Email"}
              </button>
              <button
                className={styles.secondaryButton}
                disabled={processingActionKey === textKey}
                onClick={() => resend(order, "text")}
                type="button"
              >
                {processingActionKey === textKey ? "Sending Text..." : "Resend Text"}
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
