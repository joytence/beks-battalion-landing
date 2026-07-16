"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./ticketing.module.css";

type TicketTier = {
  description: string;
  id: string;
  includes: readonly string[];
  name: string;
  priceLabel: string;
  sectionLabel: string;
  theme: string;
};

type Seat = {
  label: string;
  layoutLabel: string;
  number: number;
  row: string;
  status: "available" | "held";
  tierId: string;
};

type SeatRow = {
  gapAfter?: boolean;
  offset: number;
  row: string;
  seats: Seat[];
};

type SeatBlock = {
  blockLabel: string;
  id: string;
  rows: SeatRow[];
  tierId: string;
  variant: "center" | "wing-left" | "wing-right";
};

type SeatChart = {
  blocks: readonly SeatBlock[];
  stageLabel: string;
  totalCapacity: number;
};

type TicketCheckoutClientProps = {
  canceled: boolean;
  checkoutEnabled: boolean;
  configured: boolean;
  databaseConfigured: boolean;
  initialTierId: string;
  processingFeeLabel: string;
  seatChart: SeatChart;
  seatMapOnly: boolean;
  stripeTestMode: boolean;
  tierTestCheckoutEnabled: boolean;
  tiers: readonly TicketTier[];
};

const selectableTierIds = ["svip", "vip", "general"];
const venueBaseWidth = 2080;
const mapZoomStep = 0.18;
const maxTicketsPerOrder = 10;
const defaultTierQuantities = {
  general: 1,
  svip: 1,
  vip: 1,
} as const;

function getSeatTierName(tiers: readonly TicketTier[], tierId: string) {
  return tiers.find((tier) => tier.id === tierId)?.name || "Ticket";
}

function getSeatTierMarker(tierId: string) {
  if (tierId === "svip") {
    return "S";
  }

  if (tierId === "vip") {
    return "V";
  }

  return "G";
}

function getSeatPositionStyle(seat: Seat) {
  const horizontalMoves: Record<string, string> = {
    "LW13-3": "-9px",
    "LW14-2": "124px",
    "LW14-3": "124px",
    "LW15-2": "126px",
    "LW15-3": "117px",
    "LW16-3": "123px",
    "LW17-3": "117px",
    "RW13-1": "9px",
    "RW14-1": "-124px",
    "RW14-2": "-124px",
    "RW15-1": "-117px",
    "RW15-2": "-126px",
    "RW16-1": "-123px",
    "RW17-1": "-117px",
  };
  const translateX = horizontalMoves[seat.layoutLabel];

  if (!translateX) {
    return undefined;
  }

  return {
    ["--seat-translate-x" as string]: translateX,
    ["--seat-translate-y" as string]: "-0px",
  } as CSSProperties;
}

export function TicketCheckoutClient({
  canceled,
  checkoutEnabled,
  configured,
  databaseConfigured,
  initialTierId,
  processingFeeLabel,
  seatChart,
  seatMapOnly,
  stripeTestMode,
  tierTestCheckoutEnabled,
  tiers,
}: TicketCheckoutClientProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const venueRef = useRef<HTMLDivElement | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTierId, setSelectedTierId] = useState(initialTierId);
  const [tierQuantities, setTierQuantities] =
    useState<Record<string, number>>(defaultTierQuantities);
  const [error, setError] = useState("");
  const [fitScale, setFitScale] = useState(1);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [mapScale, setMapScale] = useState(1);
  const [hasManualZoom, setHasManualZoom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingTierId, setSubmittingTierId] = useState("");

  const selectedTier = tiers.find((tier) => tier.id === selectedTierId) || null;
  const quantity = selectedSeats.length;
  const visibleTiers = tiers.filter((tier) => selectableTierIds.includes(tier.id));
  const tierTestReady = tierTestCheckoutEnabled && configured && stripeTestMode;
  const reservedSeatReady = checkoutEnabled && configured && databaseConfigured;
  const showZoomControls = isCompactViewport && fitScale < 1;
  const shouldScaleMap = mapScale < 1;
  const scaledMapStyle =
    shouldScaleMap && mapHeight
      ? {
          height: `${mapHeight * mapScale}px`,
          width: `${venueBaseWidth * mapScale}px`,
        }
      : undefined;
  const scaledVenueStyle = shouldScaleMap
    ? ({ ["--map-scale" as string]: String(mapScale) } as CSSProperties)
    : undefined;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const venue = venueRef.current;

    if (!viewport || !venue) {
      return;
    }

    const updateScale = () => {
      const viewportWidth = viewport.clientWidth;
      const nextCompactViewport = window.innerWidth <= 900;
      const measuredHeight = venue.scrollHeight;
      const nextFitScale =
        viewportWidth < venueBaseWidth
          ? Math.max(0.22, Number((viewportWidth / venueBaseWidth).toFixed(3)))
          : 1;

      setIsCompactViewport(nextCompactViewport);
      setFitScale(nextFitScale);
      setMapHeight(measuredHeight);
      setMapScale((current) => {
        if (!hasManualZoom) {
          return nextFitScale;
        }

        return Math.min(1, Math.max(nextFitScale, current));
      });
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(viewport);
    resizeObserver.observe(venue);
    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [hasManualZoom]);

  function clampScale(nextScale: number) {
    return Math.min(1, Math.max(fitScale, Number(nextScale.toFixed(3))));
  }

  function handleZoom(action: "fit" | "in" | "out") {
    if (action === "fit") {
      setHasManualZoom(false);
      setMapScale(fitScale);
      return;
    }

    setHasManualZoom(true);
    setMapScale((current) =>
      clampScale(action === "in" ? current + mapZoomStep : current - mapZoomStep),
    );
  }

  function handleClearSelection() {
    setSelectedSeats([]);
    setSelectedTierId(initialTierId);
    setError("");
  }

  function getTierQuantity(tierId: string) {
    return tierQuantities[tierId] || 1;
  }

  function handleTierQuantityChange(tierId: string, nextValue: number) {
    const nextQuantity = Math.min(maxTicketsPerOrder, Math.max(1, nextValue || 1));

    setTierQuantities((current) => ({
      ...current,
      [tierId]: nextQuantity,
    }));
  }

  function handleSeatToggle(seat: Seat) {
    if (seat.status !== "available") {
      return;
    }

    setSelectedSeats((current) => {
      if (current.includes(seat.label)) {
        const nextSeats = current.filter((value) => value !== seat.label);
        setError("");
        return nextSeats;
      }

      if (current.length >= maxTicketsPerOrder) {
        setError(`You can select up to ${maxTicketsPerOrder} seats per order.`);
        return current;
      }

      if (selectedTierId && selectedTierId !== seat.tierId) {
        setError(
          `Keep one ticket type per order. You already selected ${getSeatTierName(tiers, selectedTierId)} seats.`,
        );
        return current;
      }

      if (!selectedTierId) {
        setSelectedTierId(seat.tierId);
      }

      setError("");
      return [...current, seat.label];
    });
  }

  async function handleCheckout() {
    if (!checkoutEnabled) {
      setError("Ticket payments are temporarily paused while Stripe is being finalized.");
      return;
    }

    if (!databaseConfigured) {
      setError("Reserved-seat checkout requires DATABASE_URL before live payments can be enabled.");
      return;
    }

    setSubmitting(true);
    setError("");

    if (quantity < 1 || !selectedTierId) {
      setError("Select at least one seat before continuing.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/tickets/checkout", {
        body: JSON.stringify({
          seatLabels: selectedSeats,
          ticketTierId: selectedTierId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "Checkout could not be started.");
      }

      window.location.href = payload.url;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Checkout could not be started.");
      setSubmitting(false);
    }
  }

  async function handleTierCheckout(tierId: string) {
    if (!tierTestCheckoutEnabled) {
      setError("Tier test checkout is not enabled yet.");
      return;
    }

    if (!configured) {
      setError("Stripe is not configured yet. Add a Stripe test secret key first.");
      return;
    }

    if (!stripeTestMode) {
      setError("Tier test checkout requires a Stripe test secret key.");
      return;
    }

    setSubmittingTierId(tierId);
    setError("");

    try {
      const response = await fetch("/api/tickets/tier-checkout", {
        body: JSON.stringify({
          quantity: getTierQuantity(tierId),
          ticketTierId: tierId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "Test checkout could not be started.");
      }

      window.location.href = payload.url;
    } catch (caughtError) {
      setSubmittingTierId("");
      setError(
        caughtError instanceof Error ? caughtError.message : "Test checkout could not be started.",
      );
    }
  }

  return (
    <div className={styles.checkoutShell}>
      <div className={styles.checkoutStack}>
        {canceled ? (
          <div className={styles.notice}>
            Checkout was canceled. Your ticket order has not been charged.
          </div>
        ) : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.notice}>
          A separate {processingFeeLabel} processing fee applies to paid orders. The fee is shown
          before payment and itemized as its own line item in Stripe Checkout.
        </div>

        {seatMapOnly ? (
          <div className={styles.mapPageHeader}>
            <a className={`${styles.secondaryButton} ${styles.backActionButton}`} href="/tickets">
              Back To Electronic Ticket Page
            </a>
          </div>
        ) : null}

        {!seatMapOnly ? (
          <div className={styles.selectorGrid}>
            {visibleTiers.map((tier) => (
              <div
                key={tier.id}
                className={`${styles.tierCard} ${styles[`tierCard${tier.theme[0].toUpperCase()}${tier.theme.slice(1)}`]} ${
                  selectedTierId === tier.id ? styles.tierCardSelected : ""
                }`}
              >
                <div className={styles.tierHeader}>
                  <span className={styles.tierName}>{tier.name}</span>
                  <span className={styles.tierPrice}>{tier.priceLabel}</span>
                </div>
                <p className={styles.tierDescription}>{tier.description}</p>
                <div className={styles.tierSection}>Location Details: {tier.sectionLabel}</div>
                <ul className={styles.tierList}>
                  {tier.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className={styles.tierCardFooter}>
                  {tierTestReady ? (
                    <>
                      <div className={styles.tierQuantityRow}>
                        <span className={styles.tierQuantityLabel}>Test Quantity</span>
                        <div className={styles.tierQuantityControl}>
                          <button
                            className={styles.tierQuantityButton}
                            type="button"
                            onClick={() => handleTierQuantityChange(tier.id, getTierQuantity(tier.id) - 1)}
                            disabled={getTierQuantity(tier.id) <= 1 || submittingTierId === tier.id}
                            aria-label={`Decrease ${tier.name} quantity`}
                          >
                            -
                          </button>
                          <input
                            className={styles.tierQuantityInput}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={maxTicketsPerOrder}
                            value={getTierQuantity(tier.id)}
                            onChange={(event) =>
                              handleTierQuantityChange(tier.id, Number(event.currentTarget.value))
                            }
                            aria-label={`${tier.name} test quantity`}
                          />
                          <button
                            className={styles.tierQuantityButton}
                            type="button"
                            onClick={() => handleTierQuantityChange(tier.id, getTierQuantity(tier.id) + 1)}
                            disabled={
                              getTierQuantity(tier.id) >= maxTicketsPerOrder || submittingTierId === tier.id
                            }
                            aria-label={`Increase ${tier.name} quantity`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        className={`${styles.primaryButton} ${styles.tierCardCheckoutButton}`}
                        type="button"
                        onClick={() => handleTierCheckout(tier.id)}
                        disabled={!tierTestReady || Boolean(submittingTierId)}
                      >
                        {submittingTierId === tier.id
                          ? "Opening Stripe Test Checkout..."
                          : "Start Test Checkout"}
                      </button>

                      <div className={styles.feeDisclosure}>
                        {processingFeeLabel} processing fee disclosed before payment
                      </div>

                      <a
                        className={`${styles.secondaryButton} ${styles.tierCardAction}`}
                        href={`/tickets?view=seats&tier=${tier.id}#seat-map`}
                      >
                        View {tier.name} Seats
                      </a>
                    </>
                  ) : (
                    <>
                      <a
                        className={`${styles.primaryButton} ${styles.tierCardCheckoutButton}`}
                        href={`/tickets?view=seats&tier=${tier.id}#seat-map`}
                      >
                        {reservedSeatReady ? `Buy ${tier.name} Seats` : `View ${tier.name} Seats`}
                      </a>

                      <div className={styles.feeDisclosure}>
                        {reservedSeatReady
                          ? `${processingFeeLabel} processing fee disclosed before payment`
                          : "Seat map preview available before payment"}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {seatMapOnly ? (
          <div className={styles.seatMapOnlyLayout}>
            <section id="seat-map" className={`${styles.seatMapCard} ${styles.seatMapCardOnly}`}>
              {showZoomControls ? (
                <div className={styles.seatMapToolbar}>
                  <div className={styles.seatMapControls}>
                    <button
                      className={styles.seatMapControlButton}
                      type="button"
                      onClick={() => handleZoom("fit")}
                    >
                      Fit
                    </button>
                    <button
                      className={styles.seatMapControlButton}
                      type="button"
                      onClick={() => handleZoom("out")}
                      disabled={mapScale <= fitScale}
                    >
                      -
                    </button>
                    <div className={styles.seatMapZoomLabel}>{Math.round(mapScale * 100)}%</div>
                    <button
                      className={styles.seatMapControlButton}
                      type="button"
                      onClick={() => handleZoom("in")}
                      disabled={mapScale >= 1}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : null}

              <div className={styles.seatMapSurface}>
                <div ref={viewportRef} className={styles.seatMapViewport}>
                  <div
                    className={`${styles.mapGestureLayer} ${shouldScaleMap ? styles.mapGestureLayerScaled : ""}`}
                    style={scaledMapStyle}
                  >
                    <div
                      ref={venueRef}
                      className={`${styles.venueShell} ${shouldScaleMap ? styles.venueShellScaled : ""}`}
                      style={scaledVenueStyle}
                    >
                      <div className={styles.seatChartTop}>
                        {seatChart.blocks.map((block) => (
                          <section
                            key={block.id}
                            className={`${styles.seatBlock} ${
                              block.variant === "wing-left"
                                ? styles.seatBlockWingLeft
                                : block.variant === "wing-right"
                                  ? styles.seatBlockWingRight
                                  : styles.seatBlockCenter
                            }`}
                          >
                            <div className={styles.seatBlockLabel}>{block.blockLabel}</div>
                            <div className={styles.seatBlockRows}>
                              {block.rows.map((row) => (
                                <div
                                  key={`${block.id}-${row.row}`}
                                  className={`${styles.seatBlockRow} ${row.gapAfter ? styles.seatBlockRowGap : ""}`}
                                  style={{ ["--seat-offset" as string]: `${row.offset}px` }}
                                >
                                  <div className={styles.seatBlockRowRail}>
                                    {row.seats.map((seat) => {
                                      const isSelected = selectedSeats.includes(seat.label);

                                      return (
                                        <button
                                          key={seat.layoutLabel}
                                          title={seat.label}
                                          className={`${styles.seatButton} ${
                                            seat.status === "held"
                                              ? styles.seatButtonHeld
                                              : isSelected
                                                ? seat.tierId === "general"
                                                  ? styles.seatButtonSelectedGa
                                                  : seat.tierId === "vip"
                                                    ? styles.seatButtonSelectedVip
                                                    : styles.seatButtonSelectedSvip
                                                : seat.tierId === "general"
                                                  ? styles.seatButtonGa
                                                  : seat.tierId === "vip"
                                                    ? styles.seatButtonVip
                                                    : styles.seatButtonSvip
                                          }`}
                                          type="button"
                                          style={getSeatPositionStyle(seat)}
                                          disabled={seat.status === "held"}
                                          aria-pressed={isSelected}
                                          aria-label={`${seat.label} ${
                                            seat.status === "held"
                                              ? "unavailable"
                                              : isSelected
                                                ? "selected"
                                                : `${getSeatTierName(tiers, seat.tierId)} seat`
                                          }`}
                                          onClick={() => handleSeatToggle(seat)}
                                        >
                                          <span aria-hidden="true">{getSeatTierMarker(seat.tierId)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>

                      <div className={styles.stageBar}>
                        <span>{seatChart.stageLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className={`${styles.orderPanel} ${styles.orderPanelAside}`}>
              <div className={styles.selectionSummary}>
                <div className={styles.selectionCount}>
                  <span>Seats Selected</span>
                  <strong>{quantity}</strong>
                </div>
                <div className={styles.selectionSeats}>
                  <span>Selected Seats</span>
                  <strong>{quantity ? selectedSeats.join(", ") : "None yet"}</strong>
                </div>
                <button
                  className={`${styles.secondaryButton} ${styles.selectionClearButton}`}
                  type="button"
                  onClick={handleClearSelection}
                  disabled={quantity < 1}
                >
                  Clear Selection
                </button>
                <div className={styles.selectionTier}>
                  <span>Selected Tier</span>
                  <strong>{selectedTier ? selectedTier.name : "None yet"}</strong>
                </div>
              </div>

              {checkoutEnabled ? (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={handleCheckout}
                  disabled={!configured || !databaseConfigured || submitting || quantity < 1 || !selectedTierId}
                >
                  {submitting ? "Redirecting To Secure Payment..." : "Continue To Secure Payment"}
                </button>
              ) : (
                <div className={styles.paymentStatusBox}>
                  <span className={styles.paymentStatusLabel}>Payments Paused</span>
                  <p className={styles.paymentStatusCopy}>
                    Stripe checkout is offline for now while the live payment flow is being set up.
                  </p>
                </div>
              )}
            </aside>
          </div>
        ) : (
          <section id="seat-map" className={styles.seatMapClosedCard}>
            <div className={styles.sectionEyebrow}>Seat Map</div>
            <h3 className={styles.seatMapClosedTitle}>Choose a ticket tier to open the venue view</h3>
            <p className={styles.seatMapClosedNote}>
              The bird&apos;s-eye seating chart stays hidden until you open the SVIP, VIP, or General
              Admission seat view above.
            </p>
          </section>
        )}

      </div>
    </div>
  );
}
