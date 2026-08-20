import Stripe from "stripe";
import { NextResponse } from "next/server";
import { sendMetaCapiEvent } from "@/lib/meta-capi";
import {
  sendReservedSeatReceiptEmail,
  sendReservedSeatSaleNotificationEmail,
} from "@/lib/ticket-email";
import { isTwilioSmsConfigured, normalizePhoneNumber, sendReservedSeatReceiptSms } from "@/lib/ticket-sms";
import { getStripe, getStripeWebhookSecret, isStripeConfigured, isStripeWebhookConfigured } from "@/lib/stripe";
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
import { getTicketTierById } from "@/lib/ticketing";

function centsToValue(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function parseMetadataCents(value: string | undefined) {
  const cents = Number(value || "0");
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

function parseMetadataQuantity(value: string | undefined) {
  const quantity = Number(value || "0");
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

function getStripePurchaseAmounts(session: Stripe.Checkout.Session) {
  const ticketQuantity = parseMetadataQuantity(session.metadata?.ticket_quantity);
  const ticketTierId = session.metadata?.ticket_tier_id || "";
  const tier = getTicketTierById(ticketTierId);
  const ticketType = tier?.name || ticketTierId;
  const processingFeeCents = parseMetadataCents(session.metadata?.processing_fee_cents);
  const expectedTicketSubtotalCents = tier ? tier.priceCents * ticketQuantity : 0;
  const expectedCheckoutSubtotalCents = expectedTicketSubtotalCents + processingFeeCents;
  const stripeAmountSubtotalCents = session.amount_subtotal || 0;
  const stripeAmountTotalCents = session.amount_total || 0;
  const stripeTaxCents = session.total_details?.amount_tax || 0;
  const stripeDiscountCents = session.total_details?.amount_discount || 0;
  const valueCents = stripeAmountTotalCents || expectedCheckoutSubtotalCents;

  return {
    expectedCheckoutSubtotalCents,
    expectedCheckoutSubtotalValue: centsToValue(expectedCheckoutSubtotalCents),
    expectedTicketSubtotalCents,
    expectedTicketSubtotalValue: centsToValue(expectedTicketSubtotalCents),
    processingFeeCents,
    processingFeeValue: centsToValue(processingFeeCents),
    stripeAmountSubtotalCents,
    stripeAmountSubtotalValue: centsToValue(stripeAmountSubtotalCents),
    stripeAmountTotalCents,
    stripeAmountTotalValue: centsToValue(stripeAmountTotalCents),
    stripeDiscountCents,
    stripeDiscountValue: centsToValue(stripeDiscountCents),
    stripeTaxCents,
    stripeTaxValue: centsToValue(stripeTaxCents),
    ticketQuantity,
    ticketTierId,
    ticketType,
    valueCents,
    valueSource: stripeAmountTotalCents > 0 ? "stripe_amount_total" : "expected_checkout_subtotal",
    value: centsToValue(valueCents),
  };
}

async function sendStripePurchaseMetaEvent(session: Stripe.Checkout.Session, eventCreated: number) {
  const amounts = getStripePurchaseAmounts(session);
  const currency = (session.currency || "usd").toUpperCase();
  const isAdminTestCheckout = session.metadata?.admin_test_checkout === "true";

  if (
    !isAdminTestCheckout &&
    amounts.stripeAmountTotalCents > 0 &&
    amounts.expectedTicketSubtotalCents > 0 &&
    amounts.stripeAmountTotalCents < amounts.expectedTicketSubtotalCents
  ) {
    console.warn("Stripe purchase amount is lower than expected ticket subtotal", {
      currency,
      expectedTicketSubtotalValue: amounts.expectedTicketSubtotalValue,
      sessionId: session.id,
      stripeAmountTotalValue: amounts.stripeAmountTotalValue,
      ticketQuantity: amounts.ticketQuantity,
      ticketType: amounts.ticketType,
    });
  }

  try {
    const metaEvent = await sendMetaCapiEvent({
      customData: {
        admin_test_checkout: isAdminTestCheckout || undefined,
        content_category: "tickets",
        content_name: session.metadata?.event_slug || "beks-battalion",
        currency,
        expected_checkout_subtotal: amounts.expectedCheckoutSubtotalValue || undefined,
        expected_ticket_subtotal: amounts.expectedTicketSubtotalValue || undefined,
        num_items: amounts.ticketQuantity || undefined,
        order_id: session.id,
        processing_fee: amounts.processingFeeValue || undefined,
        stripe_amount_subtotal: amounts.stripeAmountSubtotalValue || undefined,
        stripe_amount_total: amounts.stripeAmountTotalValue || undefined,
        stripe_discount: amounts.stripeDiscountValue || undefined,
        stripe_tax: amounts.stripeTaxValue || undefined,
        ticket_quantity: amounts.ticketQuantity || undefined,
        ticket_type: amounts.ticketType,
        ticket_tier_id: amounts.ticketTierId,
        transaction_id: session.id,
        value: amounts.value,
        value_source: amounts.valueSource,
      },
      email: session.customer_details?.email || session.customer_email || undefined,
      eventId: session.id,
      eventName: "Purchase",
      eventSourceUrl: `https://www.joystageproductions.com/tickets/confirmation?session_id=${encodeURIComponent(session.id)}`,
      eventTime: eventCreated,
      phone: session.customer_details?.phone || undefined,
      testEventCode: session.livemode
        ? undefined
        : process.env.META_TEST_EVENT_CODE?.trim() || undefined,
    });

    if (!metaEvent.ok) {
      console.error("Meta CAPI purchase event error:", metaEvent.reason);
    } else if (metaEvent.skipped) {
      console.warn("Meta CAPI purchase event skipped:", metaEvent.reason);
    } else {
      console.info("Meta CAPI purchase event sent:", {
        currency,
        expectedCheckoutSubtotalValue: amounts.expectedCheckoutSubtotalValue,
        expectedTicketSubtotalValue: amounts.expectedTicketSubtotalValue,
        isAdminTestCheckout,
        processingFeeValue: amounts.processingFeeValue,
        sessionId: session.id,
        stripeAmountSubtotalValue: amounts.stripeAmountSubtotalValue,
        stripeAmountTotalValue: amounts.stripeAmountTotalValue,
        stripeDiscountValue: amounts.stripeDiscountValue,
        stripeTaxValue: amounts.stripeTaxValue,
        ticketQuantity: amounts.ticketQuantity,
        ticketType: amounts.ticketType,
        value: amounts.value,
        valueSource: amounts.valueSource,
      });
    }
  } catch (error) {
    console.error("Meta CAPI purchase event failed unexpectedly:", error);
  }
}

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

      await sendStripePurchaseMetaEvent(session, event.created);

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
