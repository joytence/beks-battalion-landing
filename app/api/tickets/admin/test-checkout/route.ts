import { NextResponse } from "next/server";
import {
  isAuthorizedTicketAdminRequest,
  isTicketAdminConfigured,
  unauthorizedAdminResponse,
} from "@/lib/ticket-admin-auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
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
  getTierIdForSeatLabel,
} from "@/lib/ticketing";

const TEST_TICKET_UNIT_AMOUNT_CENTS = 100;

type TestCheckoutPayload = {
  seatLabels?: unknown;
  smsConsentOptIn?: unknown;
};

function getSeatLabels(value: unknown) {
  return Array.isArray(value)
    ? value.filter((seatLabel): seatLabel is string => typeof seatLabel === "string")
    : [];
}

function isChecked(value: unknown) {
  return value === true;
}

function getSingleTierIdForSeats(seatLabels: string[]) {
  const tierIds = Array.from(
    new Set(
      seatLabels
        .map((seatLabel) => getTierIdForSeatLabel(seatLabel))
        .filter((tierId): tierId is NonNullable<typeof tierId> => Boolean(tierId)),
    ),
  );

  if (tierIds.length !== 1) {
    return null;
  }

  return tierIds[0];
}

export async function POST(request: Request) {
  if (!isTicketAdminConfigured()) {
    return NextResponse.json(
      { message: "TICKET_ADMIN_SECRET is not configured yet." },
      { status: 500 },
    );
  }

  if (!(await isAuthorizedTicketAdminRequest(request))) {
    return unauthorizedAdminResponse();
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

  const payload = (await request.json()) as TestCheckoutPayload;
  const requestedSeats = getSeatLabels(payload.seatLabels);
  const ticketTierId = getSingleTierIdForSeats(requestedSeats);

  if (!ticketTierId) {
    return NextResponse.json(
      { message: "Choose one or more valid seats from the same pricing zone for this $1 test." },
      { status: 400 },
    );
  }

  const tier = getTicketTierById(ticketTierId);

  if (!tier) {
    return NextResponse.json({ message: "Ticket tier could not be resolved." }, { status: 400 });
  }

  const origin = getRequestOrigin(request);
  const stripe = getStripe();
  const smsConsentOptIn = isChecked(payload.smsConsentOptIn);
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
      smsConsentOptIn,
      ticketTierId: tier.id,
    });

    const quantity = reservation.seatLabels.length;
    const seatLabelsJoined = reservation.seatLabels.join("|");
    const metadata = {
      admin_test_checkout: "true",
      checkout_flow: "reserved_seat",
      event_slug: eventDetails.slug,
      order_id: reservation.orderId,
      processing_fee_cents: "0",
      seat_assignment: "reserved",
      seat_labels: seatLabelsJoined,
      sms_consent_opt_in: smsConsentOptIn ? "true" : "false",
      sms_consent_source: "admin_test_checkout",
      ticket_quantity: String(quantity),
      ticket_tier_id: tier.id,
    };

    const session = await stripe.checkout.sessions.create({
      cancel_url: `${origin}/tickets/admin/test-checkout?canceled=1`,
      client_reference_id: reservation.orderId,
      customer_creation: "always",
      expires_at: Math.floor(reservation.expiresAt.getTime() / 1000),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              description: `${eventDetails.dateLabel} at ${eventDetails.venue} · Admin $1 live checkout test · Seats ${reservation.seatLabels.join(", ")}`,
              name: `${eventDetails.name} - Admin $1 Test Ticket`,
            },
            unit_amount: TEST_TICKET_UNIT_AMOUNT_CENTS,
          },
          quantity,
        },
      ],
      metadata,
      mode: "payment",
      name_collection: {
        individual: {
          enabled: true,
        },
      },
      payment_intent_data: {
        metadata,
      },
      phone_number_collection: {
        enabled: true,
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

    return NextResponse.json({
      quantity,
      seatLabels: reservation.seatLabels,
      testUnitAmountCents: TEST_TICKET_UNIT_AMOUNT_CENTS,
      url: session.url,
    });
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
      { message: error instanceof Error ? error.message : "$1 test checkout could not be started." },
      { status: 500 },
    );
  }
}
