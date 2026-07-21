import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  sendReservedSeatReceiptEmail,
  sendReservedSeatSaleNotificationEmail,
} from "@/lib/ticket-email";
import { getStripe, getStripeWebhookSecret, isStripeConfigured, isStripeWebhookConfigured } from "@/lib/stripe";
import {
  claimAdminSaleNotificationEmailSend,
  markAdminSaleNotificationEmailFailed,
  markAdminSaleNotificationEmailSent,
  claimCustomerReceiptEmailSend,
  markCustomerReceiptEmailFailed,
  markCustomerReceiptEmailSent,
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
      let claimedOrder:
        | Awaited<ReturnType<typeof claimCustomerReceiptEmailSend>>
        | null = null;
      let claimedAdminSaleOrder:
        | Awaited<ReturnType<typeof claimAdminSaleNotificationEmailSend>>
        | null = null;

      try {
        await syncReservedSeatPaymentConfirmed(session);
        claimedOrder = await claimCustomerReceiptEmailSend(session.id);

        if (claimedOrder) {
          await sendReservedSeatReceiptEmail({
            livemode: session.livemode ?? false,
            order: claimedOrder,
          });
          await markCustomerReceiptEmailSent(claimedOrder.id);
          claimedOrder = null;
        }

        claimedAdminSaleOrder = await claimAdminSaleNotificationEmailSend(session.id);

        if (claimedAdminSaleOrder) {
          await sendReservedSeatSaleNotificationEmail({
            livemode: session.livemode ?? false,
            order: claimedAdminSaleOrder,
          });
          await markAdminSaleNotificationEmailSent(claimedAdminSaleOrder.id);
          claimedAdminSaleOrder = null;
        }
      } catch (error) {
        if (claimedOrder) {
          await markCustomerReceiptEmailFailed(claimedOrder.id);
        }
        if (claimedAdminSaleOrder) {
          await markAdminSaleNotificationEmailFailed(claimedAdminSaleOrder.id);
        }
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
