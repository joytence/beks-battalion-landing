import { NextResponse } from "next/server";
import {
  calculateTicketProcessingFeeCents,
  getStripe,
  getStripeTicketTaxConfig,
  isStripeConfigured,
  isStripeTestMode,
  isTicketTierTestCheckoutEnabled,
} from "@/lib/stripe";
import {
  eventDetails,
  getRequestOrigin,
  getTicketTierById,
  validateRequestedTicketQuantity,
} from "@/lib/ticketing";

type TierCheckoutPayload = {
  quantity?: unknown;
  ticketTierId?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!isTicketTierTestCheckoutEnabled()) {
    return NextResponse.json(
      { message: "Tier test checkout is not enabled yet." },
      { status: 503 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { message: "Stripe is not configured yet. Add a Stripe test secret key first." },
      { status: 500 },
    );
  }

  if (!isStripeTestMode()) {
    return NextResponse.json(
      { message: "Tier test checkout requires a Stripe test secret key." },
      { status: 412 },
    );
  }

  const payload = (await request.json()) as TierCheckoutPayload;
  const ticketTierId = clean(payload.ticketTierId);
  const tier = getTicketTierById(ticketTierId);

  if (!tier) {
    return NextResponse.json({ message: "Please select a valid ticket tier." }, { status: 400 });
  }

  const validatedQuantity = validateRequestedTicketQuantity(payload.quantity);

  if (validatedQuantity.error) {
    return NextResponse.json({ message: validatedQuantity.error }, { status: 400 });
  }

  const quantity = validatedQuantity.quantity;
  const ticketSubtotalCents = tier.priceCents * quantity;
  const processingFeeCents = calculateTicketProcessingFeeCents(ticketSubtotalCents);
  const origin = getRequestOrigin(request);
  const stripe = getStripe();
  const ticketTaxConfig = await getStripeTicketTaxConfig();

  try {
    const session = await stripe.checkout.sessions.create({
      ...(ticketTaxConfig ? { automatic_tax: ticketTaxConfig.automaticTax } : {}),
      cancel_url: `${origin}/tickets?canceled=1`,
      customer_creation: "always",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              description: `${eventDetails.dateLabel} at ${eventDetails.venue} · Tier-only test checkout without seat assignment`,
              name: `${eventDetails.name} - ${tier.name} Test Ticket`,
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
                    description: `3% processing fee for ${quantity} ${tier.name} test ticket${quantity === 1 ? "" : "s"}`,
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
        checkout_flow: "tier_test",
        event_slug: eventDetails.slug,
        processing_fee_cents: String(processingFeeCents),
        seat_assignment: "unassigned",
        seat_labels: "",
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
          checkout_flow: "tier_test",
          event_slug: eventDetails.slug,
          processing_fee_cents: String(processingFeeCents),
          seat_assignment: "unassigned",
          seat_labels: "",
          ticket_quantity: String(quantity),
          ticket_tier_id: tier.id,
        },
      },
      success_url: `${origin}/tickets/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { message: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Tier test checkout could not be started.",
      },
      { status: 500 },
    );
  }
}
