import Stripe from "stripe";
import { eventDetails } from "@/lib/ticketing";

let stripeClient: Stripe | null = null;
let performanceLocationIdPromise: Promise<string> | null = null;
const STRIPE_TICKET_TAX_CODE_DEFAULT = "txcd_50010001";
const STRIPE_TAX_LOCATION_API_VERSION = "2026-06-24.preview";

export function isTicketCheckoutEnabled() {
  return process.env.TICKET_CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
}

export function isTicketTierTestCheckoutEnabled() {
  return process.env.TICKET_TIER_TEST_CHECKOUT_ENABLED?.trim().toLowerCase() === "true";
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeKeyMode() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || "";

  if (secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) {
    return "test";
  }

  if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) {
    return "live";
  }

  return "unknown";
}

export function isStripeTestMode() {
  return getStripeKeyMode() === "test";
}

export function isStripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function isStripeTaxEnabled() {
  return process.env.STRIPE_TAX_ENABLED?.trim().toLowerCase() === "true";
}

export function getStripeTicketTaxBehavior(): Stripe.Checkout.SessionCreateParams.LineItem.PriceData.TaxBehavior {
  return "exclusive";
}

export function getStripeTicketTaxCode() {
  return process.env.STRIPE_TICKET_TAX_CODE?.trim() || STRIPE_TICKET_TAX_CODE_DEFAULT;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

async function createStripePerformanceLocation() {
  const stripe = getStripe();
  const response = await stripe.rawRequest(
    "POST",
    "/v1/tax/locations",
    {
      address: {
        city: eventDetails.venueAddress.city,
        country: eventDetails.venueAddress.country,
        line1: eventDetails.venueAddress.line1,
        postal_code: eventDetails.venueAddress.postalCode,
        state: eventDetails.venueAddress.state,
      },
      description: `${eventDetails.name} at ${eventDetails.venue}`,
      type: "performance",
    },
    {
      apiVersion: STRIPE_TAX_LOCATION_API_VERSION,
    },
  );

  const locationId =
    response && typeof response === "object" && "id" in response ? response.id : null;

  if (typeof locationId !== "string" || !locationId.trim()) {
    throw new Error("Stripe did not return a performance tax location id.");
  }

  return locationId.trim();
}

export async function getStripePerformanceLocationId() {
  const configuredLocationId = process.env.STRIPE_TAX_EVENT_LOCATION_ID?.trim();

  if (configuredLocationId) {
    return configuredLocationId;
  }

  if (!performanceLocationIdPromise) {
    performanceLocationIdPromise = createStripePerformanceLocation().catch((error) => {
      performanceLocationIdPromise = null;
      throw error;
    });
  }

  return performanceLocationIdPromise;
}

export async function getStripeTicketTaxConfig() {
  if (!isStripeTaxEnabled()) {
    return null;
  }

  const performanceLocationId = await getStripePerformanceLocationId();

  return {
    automaticTax: {
      enabled: true as const,
    },
    taxBehavior: getStripeTicketTaxBehavior(),
    taxCode: getStripeTicketTaxCode(),
    taxDetails: {
      performance_location: performanceLocationId,
      tax_code: getStripeTicketTaxCode(),
    },
  };
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return webhookSecret;
}
