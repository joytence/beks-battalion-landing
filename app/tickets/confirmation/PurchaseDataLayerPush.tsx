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
    ticket_quantity: number;
    ticket_type: string;
    transaction_id: string;
    value: number;
  };
  event: "purchase";
  event_id: string;
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

export function PurchaseDataLayerPush({
  metaAdvancedMatching,
  purchase,
}: PurchaseDataLayerPushProps) {
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.__joyStageTrackedPurchaseIds = window.__joyStageTrackedPurchaseIds || [];

    if (window.__joyStageTrackedPurchaseIds.includes(purchase.transaction_id)) {
      return;
    }

    window.__ticketPurchase = purchase;

    if (metaAdvancedMatching && Object.keys(metaAdvancedMatching).length > 0) {
      window.__joyStageMetaAdvancedMatching = metaAdvancedMatching;
    }

    window.dataLayer.push(purchase);
    window.__joyStageTrackedPurchaseIds.push(purchase.transaction_id);
  }, [metaAdvancedMatching, purchase]);

  return null;
}
