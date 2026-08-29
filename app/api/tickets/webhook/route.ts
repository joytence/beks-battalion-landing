import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  sendReservedSeatReceiptEmail,
  sendReservedSeatSaleNotificationEmail,
} from "@/lib/ticket-email";
import { isTwilioSmsConfigured, normalizePhoneNumber, sendReservedSeatReceiptSms } from "@/lib/ticket-sms";
import { getStripe, getStripeWebhookSecret, isStripeConfigured, isStripeWebhookConfigured } from "@/lib/stripe";
import {
  getStripePurchaseAmounts,
  sendClaimedStripePurchaseMetaEvent,
} from "@/lib/stripe-purchase-tracking";
import {
  claimAdminSaleNotificationEmailSend,
  claimCustomerReceiptSmsSend,
  markAdminSaleNotificationEmailFailed,
  markAdminSaleNotificationEmailSent,
  claimCustomerReceiptEmailSend,
  markCustomerReceiptEmailFailed,
  markCustomerReceiptEmailSent,
  markCustomerReceiptSmsFailed,
  markCustomerReceiptSmsSent,
  markCustomerReceiptSmsSkipped,
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
      let claimedSmsOrder:
        | Awaited<ReturnType<typeof claimCustomerReceiptSmsSend>>
        | null = null;
      const amounts = getStripePurchaseAmounts(session);

      console.info("Stripe ticket payment confirmed", {
        amountTotalValue: amounts.stripeAmountTotalValue,
        checkoutFlow: session.metadata?.checkout_flow || "",
        expectedCheckoutSubtotalValue: amounts.expectedCheckoutSubtotalValue,
        expectedTicketSubtotalValue: amounts.expectedTicketSubtotalValue,
        isAdminTestCheckout: session.metadata?.admin_test_checkout === "true",
        orderId: session.metadata?.order_id || "",
        paymentStatus: session.payment_status,
        processingFeeValue: amounts.processingFeeValue,
        seatLabels: session.metadata?.seat_labels || "",
        sessionId: session.id,
        stripeAmountSubtotalValue: amounts.stripeAmountSubtotalValue,
        stripeDiscountValue: amounts.stripeDiscountValue,
        stripeTaxValue: amounts.stripeTaxValue,
        ticketQuantity: amounts.ticketQuantity,
        ticketTierId: amounts.ticketTierId,
        ticketType: amounts.ticketType,
      });

      if (session.payment_status !== "paid") {
        console.info("Stripe checkout session completed before payment was confirmed; waiting for paid status.", {
          paymentStatus: session.payment_status,
          sessionId: session.id,
        });
        break;
      }

      try {
        await syncReservedSeatPaymentConfirmed(session);
        await sendClaimedStripePurchaseMetaEvent(session, event.created, "stripe_webhook");
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

        if (isTwilioSmsConfigured()) {
          claimedSmsOrder = await claimCustomerReceiptSmsSend(session.id);

          if (claimedSmsOrder) {
            if (!normalizePhoneNumber(claimedSmsOrder.purchaserPhone || "")) {
              await markCustomerReceiptSmsSkipped(claimedSmsOrder.id);
              claimedSmsOrder = null;
            } else {
              await sendReservedSeatReceiptSms({
                livemode: session.livemode ?? false,
                order: claimedSmsOrder,
              });
              await markCustomerReceiptSmsSent(claimedSmsOrder.id);
              claimedSmsOrder = null;
            }
          }
        }
      } catch (error) {
        if (claimedOrder) {
          await markCustomerReceiptEmailFailed(claimedOrder.id);
        }
        if (claimedAdminSaleOrder) {
          await markAdminSaleNotificationEmailFailed(claimedAdminSaleOrder.id);
        }
        if (claimedSmsOrder) {
          await markCustomerReceiptSmsFailed(claimedSmsOrder.id);
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
