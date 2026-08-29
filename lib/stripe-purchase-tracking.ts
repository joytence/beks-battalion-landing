import type Stripe from "stripe";
import { sendMetaCapiEvent, type MetaCapiEventResult } from "@/lib/meta-capi";
import {
  claimMetaCapiPurchaseEventSend,
  markMetaCapiPurchaseEventFailed,
  markMetaCapiPurchaseEventSent,
} from "@/lib/ticketing-store";
import { getTicketTierById } from "@/lib/ticketing";

type StripePurchaseEventSource = "confirmation_page" | "stripe_webhook";

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

export function getStripePurchaseAmounts(session: Stripe.Checkout.Session) {
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

export async function sendStripePurchaseMetaEvent(
  session: Stripe.Checkout.Session,
  eventCreated: number,
  eventSource: StripePurchaseEventSource,
): Promise<MetaCapiEventResult> {
  if (session.payment_status !== "paid") {
    return {
      ok: true,
      reason: `Stripe Checkout Session payment_status is ${session.payment_status}; Purchase was not sent.`,
      skipped: true,
    };
  }

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
        num_items: 1,
        order_id: session.id,
        processing_fee: amounts.processingFeeValue || undefined,
        purchase_event_source: eventSource,
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
      clientIpAddress: session.metadata?.client_ip_address || undefined,
      clientUserAgent: session.metadata?.client_user_agent || undefined,
      email: session.customer_details?.email || session.customer_email || undefined,
      eventId: session.id,
      eventName: "Purchase",
      eventSourceUrl: `https://www.joystageproductions.com/tickets/confirmation?session_id=${encodeURIComponent(session.id)}`,
      eventTime: eventCreated,
      externalId: session.client_reference_id || session.metadata?.order_id || session.id,
      fbc: session.metadata?.fbc || undefined,
      fbp: session.metadata?.fbp || undefined,
      phone: session.customer_details?.phone || undefined,
      testEventCode: session.livemode
        ? undefined
        : process.env.META_TEST_EVENT_CODE?.trim() || undefined,
    });

    if (!metaEvent.ok) {
      console.error("Meta CAPI purchase event error:", {
        reason: metaEvent.reason,
        sessionId: session.id,
        source: eventSource,
      });
    } else if (metaEvent.skipped) {
      console.warn("Meta CAPI purchase event skipped:", {
        reason: metaEvent.reason,
        sessionId: session.id,
        source: eventSource,
      });
    } else {
      console.info("Meta CAPI purchase event sent:", {
        currency,
        expectedCheckoutSubtotalValue: amounts.expectedCheckoutSubtotalValue,
        expectedTicketSubtotalValue: amounts.expectedTicketSubtotalValue,
        isAdminTestCheckout,
        processingFeeValue: amounts.processingFeeValue,
        sessionId: session.id,
        source: eventSource,
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

    return metaEvent;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Meta CAPI error.";
    console.error("Meta CAPI purchase event failed unexpectedly:", {
      reason,
      sessionId: session.id,
      source: eventSource,
    });
    return {
      ok: false,
      reason,
      skipped: false,
    };
  }
}

export async function sendClaimedStripePurchaseMetaEvent(
  session: Stripe.Checkout.Session,
  eventCreated: number,
  eventSource: StripePurchaseEventSource,
) {
  if (session.payment_status !== "paid") {
    console.info("Meta CAPI purchase event skipped for unpaid Stripe session:", {
      paymentStatus: session.payment_status,
      sessionId: session.id,
      source: eventSource,
    });
    return null;
  }

  const claimedOrder = await claimMetaCapiPurchaseEventSend(session.id);

  if (!claimedOrder) {
    console.info("Meta CAPI purchase event already sent or locked:", {
      sessionId: session.id,
      source: eventSource,
    });
    return null;
  }

  const result = await sendStripePurchaseMetaEvent(session, eventCreated, eventSource);

  if (result.ok && !result.skipped) {
    await markMetaCapiPurchaseEventSent(claimedOrder.id);
  } else {
    await markMetaCapiPurchaseEventFailed(claimedOrder.id);
  }

  return result;
}
