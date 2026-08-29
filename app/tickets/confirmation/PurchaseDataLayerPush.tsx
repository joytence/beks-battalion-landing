"use client";

import { useEffect } from "react";
import { hasTrackingConsent, trackingConsentChangedEvent } from "@/app/CookieConsent";

export type PurchaseDataLayerPayload = {
  currency: string;
  ecommerce: {
    currency: string;
    items: {
      item_category: string;
      item_id: string;
      item_name: string;
      item_variant: string;
      price: number;
      quantity: 1;
      ticket_quantity: number;
    }[];
    num_items: number;
    ticket_quantity: number;
    ticket_type: string;
    transaction_id: string;
    value: number;
  };
  event: "stripe_checkout_purchase_confirmed";
  event_id: string;
  meta_event_name: "Purchase";
  num_items: number;
  ticket_quantity: number;
  ticket_type: string;
  transaction_id: string;
  value: number;
};

type PurchaseDataLayerPushProps = {
  metaAdvancedMatching?: Record<string, string>;
  purchase: PurchaseDataLayerPayload;
};

declare global {
  interface Window {
    __joyStageMetaAdvancedMatching?: Record<string, string>;
    __joyStageTrackedPurchaseIds?: string[];
    __ticketPurchase?: PurchaseDataLayerPayload;
    dataLayer?: unknown[];
  }
}

const trackedPurchaseStoragePrefix = "joy_stage_meta_purchase:";

function getTrackedPurchaseStorageKey(transactionId: string) {
  return `${trackedPurchaseStoragePrefix}${transactionId}`;
}

function hasStoredPurchaseTracking(transactionId: string) {
  try {
    return window.localStorage.getItem(getTrackedPurchaseStorageKey(transactionId)) !== null;
  } catch {
    return false;
  }
}

function storePurchaseTracking(transactionId: string) {
  try {
    window.localStorage.setItem(getTrackedPurchaseStorageKey(transactionId), new Date().toISOString());
  } catch {
    // Browser storage can be unavailable in private or restricted sessions.
  }
}

function hasBrowserTrackingConsent() {
  try {
    return hasTrackingConsent();
  } catch {
    return false;
  }
}

export function PurchaseDataLayerPush({
  metaAdvancedMatching,
  purchase,
}: PurchaseDataLayerPushProps) {
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.__joyStageTrackedPurchaseIds = window.__joyStageTrackedPurchaseIds || [];

    const transactionId = purchase.transaction_id;
    let retryTimer: number | undefined;

    const hasAlreadyTracked = () =>
      window.__joyStageTrackedPurchaseIds?.includes(transactionId) ||
      hasStoredPurchaseTracking(transactionId);

    const attemptBrowserPurchaseTrack = () => {
      if (hasAlreadyTracked()) {
        return true;
      }

      window.__ticketPurchase = purchase;

      if (metaAdvancedMatching && Object.keys(metaAdvancedMatching).length > 0) {
        window.__joyStageMetaAdvancedMatching = metaAdvancedMatching;
      }

      if (!hasBrowserTrackingConsent() || typeof window.fbq !== "function") {
        return false;
      }

      const item = purchase.ecommerce.items[0];

      window.fbq(
        "track",
        "Purchase",
        {
          content_category: "tickets",
          content_ids: item ? [item.item_id] : [purchase.transaction_id],
          content_name: item?.item_name || purchase.ticket_type,
          content_type: "product",
          contents: [
            {
              id: item?.item_id || purchase.transaction_id,
              item_price: purchase.value,
              quantity: 1,
              ticket_quantity: purchase.ticket_quantity,
            },
          ],
          currency: purchase.currency,
          num_items: 1,
          order_id: purchase.transaction_id,
          ticket_quantity: purchase.ticket_quantity,
          ticket_type: purchase.ticket_type,
          value: purchase.value,
        },
        {
          eventID: purchase.event_id,
        },
      );

      const dataLayer = window.dataLayer || (window.dataLayer = []);

      dataLayer.push({
        ...purchase,
        browser_event_id: purchase.event_id,
        browser_event_name: "Purchase",
      });
      window.__joyStageTrackedPurchaseIds?.push(transactionId);
      storePurchaseTracking(transactionId);
      return true;
    };

    const scheduleRetry = (attemptsLeft: number) => {
      if (attemptsLeft < 1 || attemptBrowserPurchaseTrack()) {
        return;
      }

      retryTimer = window.setTimeout(() => scheduleRetry(attemptsLeft - 1), 250);
    };

    const handleTrackingConsentChanged = () => {
      scheduleRetry(16);
    };

    scheduleRetry(16);
    window.addEventListener(trackingConsentChangedEvent, handleTrackingConsentChanged);

    return () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      window.removeEventListener(trackingConsentChangedEvent, handleTrackingConsentChanged);
    };
  }, [metaAdvancedMatching, purchase]);

  return null;
}
