import { NextResponse } from "next/server";
import {
  calculateTicketProcessingFeeCents,
  getStripe,
  getStripeTicketTaxConfig,
  isStripeConfigured,
} from "@/lib/stripe";
import {
  eventDetails,
  getRequestOrigin,
  getTicketTierById,
  parseTicketUpgradeAccessToken,
  ticketUpgradesEnabled,
} from "@/lib/ticketing";
import {
  getTicketOrderByCheckoutSessionId,
  isTicketingDatabaseConfigured,
  reserveTicketUpgradeCheckout,
} from "@/lib/ticketing-store";

type UpgradePayload = {
  access?: unknown;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!ticketUpgradesEnabled) {
    return NextResponse.json(
      { message: "Ticket upgrades are temporarily unavailable. Please contact Joy Stage Productions for assistance." },
      { status: 503 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ message: "Stripe is not configured yet." }, { status: 500 });
  }

  if (!isTicketingDatabaseConfigured()) {
    return NextResponse.json(
      { message: "The ticket database is required before upgrades can be enabled." },
      { status: 500 },
    );
  }

  const payload = (await request.json()) as UpgradePayload;
  const access = clean(payload.access);
  const parsedAccess = access ? parseTicketUpgradeAccessToken(access) : null;

  if (!parsedAccess) {
    return NextResponse.json({ message: "This upgrade link is invalid or expired." }, { status: 400 });
  }

  const stripe = getStripe();
  const originalSession = await stripe.checkout.sessions.retrieve(parsedAccess.sessionId);

  if (
    originalSession.payment_status !== "paid" ||
    originalSession.metadata?.checkout_flow !== "reserved_seat"
  ) {
    return NextResponse.json(
      { message: "The original ticket order must be fully paid before it can be upgraded." },
      { status: 409 },
    );
  }

  const order = await getTicketOrderByCheckoutSessionId(originalSession.id);

  if (!order || order.orderStatus !== "paid") {
    return NextResponse.json({ message: "The original ticket order could not be verified." }, { status: 404 });
  }

  const currentTier = getTicketTierById(order.ticketTierId);
  const svipTier = getTicketTierById("svip");

  if (!currentTier || !svipTier || currentTier.id === "svip") {
    return NextResponse.json({ message: "This order is not eligible for an SVIP upgrade." }, { status: 409 });
  }

  const upgradeSubtotalCents = (svipTier.priceCents - currentTier.priceCents) * order.ticketQuantity;
  const processingFeeCents = calculateTicketProcessingFeeCents(upgradeSubtotalCents);
  const origin = getRequestOrigin(request);
  const ticketTaxConfig = await getStripeTicketTaxConfig();

  if (upgradeSubtotalCents <= 0) {
    return NextResponse.json({ message: "There is no upgrade balance due for this order." }, { status: 409 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      ...(ticketTaxConfig ? { automatic_tax: ticketTaxConfig.automaticTax } : {}),
      cancel_url: `${origin}/tickets/upgrade?access=${encodeURIComponent(access)}&canceled=1`,
      customer_creation: "always",
      customer_email: order.purchaserEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              description: `${eventDetails.name} · Upgrade ${currentTier.name} to SVIP · ${order.ticketQuantity} ticket${order.ticketQuantity === 1 ? "" : "s"}`,
              name: `${eventDetails.name} - SVIP Upgrade`,
              ...(ticketTaxConfig ? { tax_details: ticketTaxConfig.taxDetails } : {}),
            },
            ...(ticketTaxConfig ? { tax_behavior: ticketTaxConfig.taxBehavior } : {}),
            unit_amount: svipTier.priceCents - currentTier.priceCents,
          },
          quantity: order.ticketQuantity,
        },
        ...(processingFeeCents > 0
          ? [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    description: "3% processing fee for the SVIP upgrade",
                    name: "Upgrade Processing Fee",
                  },
                  unit_amount: processingFeeCents,
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      metadata: {
        checkout_flow: "ticket_upgrade",
        event_slug: eventDetails.slug,
        order_id: order.id,
        original_checkout_session_id: originalSession.id,
        processing_fee_cents: String(processingFeeCents),
        seat_assignment: "preserved",
        ticket_quantity: String(order.ticketQuantity),
        ticket_tier_id: "svip",
        upgrade_from_tier_id: currentTier.id,
        upgrade_to_tier_id: "svip",
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
          checkout_flow: "ticket_upgrade",
          event_slug: eventDetails.slug,
          order_id: order.id,
          original_checkout_session_id: originalSession.id,
          ticket_quantity: String(order.ticketQuantity),
          ticket_tier_id: "svip",
          upgrade_from_tier_id: currentTier.id,
          upgrade_to_tier_id: "svip",
        },
      },
      success_url: `${origin}/tickets/upgrade/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.url) {
      return NextResponse.json({ message: "Stripe did not return an upgrade checkout URL." }, { status: 502 });
    }

    try {
      await reserveTicketUpgradeCheckout({
        amountTotal: session.amount_total || upgradeSubtotalCents + processingFeeCents,
        checkoutSessionId: session.id,
        orderId: order.id,
      });
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "The SVIP upgrade could not be started." },
      { status: 500 },
    );
  }
}
