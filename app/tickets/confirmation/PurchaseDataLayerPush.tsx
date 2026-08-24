"use client";

import { useEffect } from "react";

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
      quantity: number;
    }[];
    num_items: number;
    ticket_quantity: number;
    ticket_type: string;
    transaction_id: string;
    value: number;
  };
  event: "purchase";
  event_id: string;
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

const trackedPurchaseStoragePrefix = "joy_stage_tracked_purchase:";

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

export function PurchaseDataLayerPush({
  metaAdvancedMatching,
  purchase,
}: PurchaseDataLayerPushProps) {
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.__joyStageTrackedPurchaseIds = window.__joyStageTrackedPurchaseIds || [];

    const transactionId = purchase.transaction_id;

    if (
      window.__joyStageTrackedPurchaseIds.includes(transactionId) ||
      hasStoredPurchaseTracking(transactionId)
    ) {
      return;
    }

    window.__ticketPurchase = purchase;

    if (metaAdvancedMatching && Object.keys(metaAdvancedMatching).length > 0) {
      window.__joyStageMetaAdvancedMatching = metaAdvancedMatching;
    }

    window.dataLayer.push(purchase);
    window.__joyStageTrackedPurchaseIds.push(transactionId);
    storePurchaseTracking(transactionId);
  }, [metaAdvancedMatching, purchase]);

  return null;
}
