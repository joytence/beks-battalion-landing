"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

type ConfirmationTrackingDataLayerProps = {
  currency: string;
  ticketQuantity: number;
  ticketType: string;
  transactionId: string;
  value: number;
};

export function ConfirmationTrackingDataLayer({
  currency,
  ticketQuantity,
  ticketType,
  transactionId,
  value,
}: ConfirmationTrackingDataLayerProps) {
  useEffect(() => {
    const storageKey = `ticket_purchase_confirmation:${transactionId}`;

    try {
      if (window.sessionStorage.getItem(storageKey) === "sent") {
        return;
      }
    } catch {
      // Ignore storage failures and continue pushing the event.
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "ticket_purchase_confirmation",
      transaction_id: transactionId,
      value,
      currency,
      ticket_quantity: ticketQuantity,
      ticket_type: ticketType,
      ecommerce: {
        currency,
        transaction_id: transactionId,
        value,
      },
    });

    try {
      window.sessionStorage.setItem(storageKey, "sent");
    } catch {
      // Ignore storage failures after the push succeeds.
    }
  }, [currency, ticketQuantity, ticketType, transactionId, value]);

  return null;
}
