"use client";

import { useMemo, useState } from "react";
import styles from "../../ticketing.module.css";

type AdminSeatStatus =
  | "all"
  | "available"
  | "blocked"
  | "converted"
  | "expired"
  | "held"
  | "paid"
  | "released"
  | "unavailable";

type SeatRecord = {
  amountTotal: number | null;
  blockLabel: string;
  checkoutFlow: string | null;
  checkoutSessionId: string | null;
  currency: string | null;
  expiresAt: string | null;
  holdStatus: string | null;
  isUnavailable: boolean;
  label: string;
  layoutLabel: string;
  orderId: string | null;
  orderStatus: string | null;
  paidAt: string | null;
  purchaserEmail: string;
  purchaserName: string;
  purchaserPhone: string;
  row: string;
  seatAssignmentMode: string | null;
  status: Exclude<AdminSeatStatus, "all" | "unavailable">;
  ticketId: string | null;
  ticketIndex: number | null;
  ticketStatus: string | null;
  ticketTierId: string;
  tierName: string;
  updatedAt: string | null;
};

type SeatDatabaseResponse = {
  event: {
    dateLabel: string;
    name: string;
    slug: string;
    venue: string;
  };
  generatedAt: string;
  seats: SeatRecord[];
  summary: Record<Exclude<AdminSeatStatus, "all"> | "total", number>;
  message?: string;
};

const statusOptions: { label: string; value: AdminSeatStatus }[] = [
  { label: "All seats", value: "all" },
  { label: "Unavailable only", value: "unavailable" },
  { label: "Available", value: "available" },
  { label: "Paid", value: "paid" },
  { label: "Blocked", value: "blocked" },
  { label: "Held", value: "held" },
  { label: "Converted", value: "converted" },
  { label: "Released", value: "released" },
  { label: "Expired", value: "expired" },
];

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(amountTotal: number | null, currency: string | null) {
  if (typeof amountTotal !== "number") {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    currency: currency || "usd",
    style: "currency",
  }).format(amountTotal / 100);
}

function escapeCsvCell(value: string | number | null | undefined) {
  const rawValue = value === null || value === undefined ? "" : String(value);
  return `"${rawValue.replaceAll('"', '""')}"`;
}

function buildCsv(seats: SeatRecord[]) {
  const headers = [
    "Seat",
    "Status",
    "Tier",
    "Section",
    "Row",
    "Purchaser Name",
    "Purchaser Email",
    "Purchaser Phone",
    "Order Status",
    "Order ID",
    "Checkout Session",
    "Amount",
    "Seat Mode",
    "Hold Status",
    "Ticket Status",
    "Paid At",
    "Expires At",
    "Updated At",
  ];

  const rows = seats.map((seat) => [
    seat.label,
    seat.status,
    seat.tierName,
    seat.blockLabel,
    seat.row,
    seat.purchaserName,
    seat.purchaserEmail,
    seat.purchaserPhone,
    seat.orderStatus,
    seat.orderId,
    seat.checkoutSessionId,
    formatMoney(seat.amountTotal, seat.currency),
    seat.seatAssignmentMode,
    seat.holdStatus,
    seat.ticketStatus,
    formatDate(seat.paidAt),
    formatDate(seat.expiresAt),
    formatDate(seat.updatedAt),
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function getSearchHaystack(seat: SeatRecord) {
  return [
    seat.label,
    seat.layoutLabel,
    seat.status,
    seat.tierName,
    seat.blockLabel,
    seat.row,
    seat.purchaserName,
    seat.purchaserEmail,
    seat.purchaserPhone,
    seat.orderId,
    seat.checkoutSessionId,
    seat.seatAssignmentMode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function AdminSeatDatabaseTools() {
  const [adminSecret, setAdminSecret] = useState("");
  const [data, setData] = useState<SeatDatabaseResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminSeatStatus>("all");

  const filteredSeats = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return (data?.seats || []).filter((seat) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "unavailable" ? seat.isUnavailable : seat.status === statusFilter);
      const matchesSearch = !searchTerm || getSearchHaystack(seat).includes(searchTerm);

      return matchesStatus && matchesSearch;
    });
  }, [data?.seats, search, statusFilter]);

  async function loadSeatDatabase() {
    if (!adminSecret.trim()) {
      setError("Enter the admin secret first.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("/api/tickets/admin/seats", {
        headers: {
          authorization: `Bearer ${adminSecret.trim()}`,
        },
      });
      const payload = (await response.json()) as SeatDatabaseResponse;

      if (!response.ok) {
        throw new Error(payload.message || "Seat database lookup failed.");
      }

      setData(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Seat database lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (filteredSeats.length < 1) {
      setError("There are no rows to export with the current filters.");
      return;
    }

    const blob = new Blob([buildCsv(filteredSeats)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `joy-stage-seat-database-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.adminPanelStack}>
      <div className={styles.notice}>
        This page shows every generated venue seat and overlays database activity from checkouts,
        admin blocks, released seats, expired holds, and paid tickets. Customer/order details only
        appear after the correct admin secret is supplied.
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
          <span>Search Seats / Orders</span>
          <input
            className={styles.textInput}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SB4-10, blocked, name, email, order ID"
            type="search"
            value={search}
          />
        </label>
      </div>

      <div className={styles.adminFormGrid}>
        <label className={styles.field}>
          <span>Status Filter</span>
          <select
            className={styles.select}
            onChange={(event) => setStatusFilter(event.target.value as AdminSeatStatus)}
            value={statusFilter}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.adminActionRow}>
          <button
            className={styles.primaryButton}
            disabled={loading || !adminSecret.trim()}
            onClick={loadSeatDatabase}
            type="button"
          >
            {loading ? "Loading Seats..." : "Load Seat Database"}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={!data || filteredSeats.length < 1}
            onClick={downloadCsv}
            type="button"
          >
            Download CSV
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {data ? (
        <>
          <div className={styles.seatDatabaseSummaryGrid}>
            <div>
              <span>Total Seats</span>
              <strong>{data.summary.total}</strong>
            </div>
            <div>
              <span>Available</span>
              <strong>{data.summary.available}</strong>
            </div>
            <div>
              <span>Unavailable</span>
              <strong>{data.summary.unavailable}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{data.summary.paid}</strong>
            </div>
            <div>
              <span>Blocked</span>
              <strong>{data.summary.blocked}</strong>
            </div>
            <div>
              <span>Held</span>
              <strong>{data.summary.held}</strong>
            </div>
            <div>
              <span>Released</span>
              <strong>{data.summary.released}</strong>
            </div>
            <div>
              <span>Expired</span>
              <strong>{data.summary.expired}</strong>
            </div>
          </div>

          <div className={styles.selectionSummary}>
            <div className={styles.selectionSeats}>
              <span>Current View</span>
              <strong>
                Showing {filteredSeats.length} of {data.summary.total} seats. Last loaded{" "}
                {formatDate(data.generatedAt)}.
              </strong>
            </div>
          </div>

          <div className={styles.seatDatabaseTableWrap}>
            <table className={styles.seatDatabaseTable}>
              <thead>
                <tr>
                  <th>Seat</th>
                  <th>Status</th>
                  <th>Tier</th>
                  <th>Section</th>
                  <th>Purchaser</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Order</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredSeats.map((seat) => (
                  <tr key={`${seat.label}-${seat.orderId || "none"}`}>
                    <td>
                      <strong>{seat.label}</strong>
                      {seat.row ? <span>Row {seat.row}</span> : null}
                    </td>
                    <td>
                      <span className={`${styles.seatStatusPill} ${styles[`seatStatus_${seat.status}`]}`}>
                        {seat.status}
                      </span>
                    </td>
                    <td>{seat.tierName}</td>
                    <td>{seat.blockLabel}</td>
                    <td>{seat.purchaserName || "-"}</td>
                    <td>{seat.purchaserEmail || "-"}</td>
                    <td>{seat.purchaserPhone || "-"}</td>
                    <td>
                      {seat.orderId ? (
                        <>
                          <strong>{seat.orderStatus || "order"}</strong>
                          <span>{seat.orderId}</span>
                          {seat.amountTotal ? <span>{formatMoney(seat.amountTotal, seat.currency)}</span> : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{formatDate(seat.updatedAt) || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
