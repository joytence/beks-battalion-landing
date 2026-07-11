import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret, isStripeConfigured, isStripeWebhookConfigured } from "@/lib/stripe";
import {
  syncReservedSeatCheckoutExpired,
  syncReservedSeatPaymentConfirmed,
  syncReservedSeatPaymentFailed,
  TicketingStoreError,
} from "@/lib/ticketing-store";

export async function POST(request: Request) {
  if (!isStripeConfigured() || !isStripeWebhookConfigured()) {
    return NextResponse.json(
      { message: "Stripe webhook handling is not configured yet." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ message: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripe();

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Stripe webhook signature verification failed.",
      },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;

      try {
        await syncReservedSeatPaymentConfirmed(session);
      } catch (error) {
        if (error instanceof TicketingStoreError) {
          return NextResponse.json({ message: error.message }, { status: error.status });
        }

        return NextResponse.json(
          {
            message: error instanceof Error ? error.message : "Reserved-seat fulfillment failed.",
          },
          { status: 500 },
        );
      }

      console.info("Stripe ticket payment confirmed", {
        checkoutFlow: session.metadata?.checkout_flow || "",
        orderId: session.metadata?.order_id || "",
        paymentStatus: session.payment_status,
        seatLabels: session.metadata?.seat_labels || "",
        sessionId: session.id,
        ticketTierId: session.metadata?.ticket_tier_id || "",
      });
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;

      await syncReservedSeatPaymentFailed(session);

      console.warn("Stripe ticket payment failed", {
        orderId: session.metadata?.order_id || "",
        sessionId: session.id,
        ticketTierId: session.metadata?.ticket_tier_id || "",
      });
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;

      await syncReservedSeatCheckoutExpired(session);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
