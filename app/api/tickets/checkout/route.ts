import { NextResponse } from "next/server";
import {
  calculateTicketProcessingFeeCents,
  getStripe,
  getStripeTicketTaxConfig,
  isStripeConfigured,
  isTicketCheckoutEnabled,
} from "@/lib/stripe";
import {
  attachCheckoutSessionToReservedOrder,
  createReservedSeatCheckoutReservation,
  isTicketingDatabaseConfigured,
  releaseReservedSeatOrder,
  TicketingStoreError,
} from "@/lib/ticketing-store";
import {
  eventDetails,
  getRequestOrigin,
  getTicketTierById,
} from "@/lib/ticketing";

type CheckoutPayload = {
  seatLabels?: unknown;
  ticketTierId?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!isTicketCheckoutEnabled()) {
    return NextResponse.json(
      { message: "Ticket payments are temporarily paused while Stripe is being finalized." },
      { status: 503 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY first." },
      { status: 500 },
    );
  }

  if (!isTicketingDatabaseConfigured()) {
    return NextResponse.json(
      { message: "DATABASE_URL is required before reserved-seat checkout can be enabled." },
      { status: 500 },
    );
  }

  const payload = (await request.json()) as CheckoutPayload;
  const ticketTierId = clean(payload.ticketTierId);
  const tier = getTicketTierById(ticketTierId);

  if (!tier) {
    return NextResponse.json({ message: "Please select a valid ticket tier." }, { status: 400 });
  }

  const requestedSeats = Array.isArray(payload.seatLabels)
    ? payload.seatLabels.filter((seat): seat is string => typeof seat === "string")
    : [];
  const origin = getRequestOrigin(request);
  const stripe = getStripe();
  const ticketTaxConfig = await getStripeTicketTaxConfig();
  let reservation:
    | {
        expiresAt: Date;
        orderId: string;
        seatLabels: string[];
      }
    | undefined;

  try {
    reservation = await createReservedSeatCheckoutReservation({
      seatLabels: requestedSeats,
      ticketTierId: tier.id,
    });

    const quantity = reservation.seatLabels.length;
    const ticketSubtotalCents = tier.priceCents * quantity;
    const processingFeeCents = calculateTicketProcessingFeeCents(ticketSubtotalCents);
    const seatLabelsJoined = reservation.seatLabels.join("|");
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${origin}/tickets?canceled=1`,
      client_reference_id: reservation.orderId,
      customer_creation: "always",
      expires_at: Math.floor(reservation.expiresAt.getTime() / 1000),
      ...(ticketTaxConfig ? { automatic_tax: ticketTaxConfig.automaticTax } : {}),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              description: `${eventDetails.dateLabel} at ${eventDetails.venue} · Seats ${reservation.seatLabels.join(", ")}`,
              name: `${eventDetails.name} - ${tier.name}`,
              ...(ticketTaxConfig ? { tax_details: ticketTaxConfig.taxDetails } : {}),
            },
            ...(ticketTaxConfig ? { tax_behavior: ticketTaxConfig.taxBehavior } : {}),
            unit_amount: tier.priceCents,
          },
          quantity,
        },
        ...(processingFeeCents > 0
          ? [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    description: `3% processing fee for ${quantity} ${tier.name} ticket${quantity === 1 ? "" : "s"}`,
                    name: "Processing Fee",
                  },
                  unit_amount: processingFeeCents,
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      metadata: {
        checkout_flow: "reserved_seat",
        event_slug: eventDetails.slug,
        order_id: reservation.orderId,
        processing_fee_cents: String(processingFeeCents),
        seat_assignment: "reserved",
        seat_labels: seatLabelsJoined,
        ticket_quantity: String(quantity),
        ticket_tier_id: tier.id,
      },
      mode: "payment",
      name_collection: {
        individual: {
          enabled: true,
        },
      },
      phone_number_collection: {
        enabled: true,
      },
      payment_intent_data: {
        metadata: {
          checkout_flow: "reserved_seat",
          event_slug: eventDetails.slug,
          order_id: reservation.orderId,
          processing_fee_cents: String(processingFeeCents),
          seat_assignment: "reserved",
          seat_labels: seatLabelsJoined,
          ticket_quantity: String(quantity),
          ticket_tier_id: tier.id,
        },
      },
      success_url: `${origin}/tickets/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.url) {
      throw new TicketingStoreError("Stripe did not return a checkout URL.", 502);
    }

    await attachCheckoutSessionToReservedOrder({
      checkoutSessionId: session.id,
      orderId: reservation.orderId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (reservation) {
      await releaseReservedSeatOrder({
        orderId: reservation.orderId,
        orderStatus: "canceled",
        seatStatus: "released",
      });
    }

    if (error instanceof TicketingStoreError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Checkout could not be started." },
      { status: 500 },
    );
  }
}
