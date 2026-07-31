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
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "purchase",
      transaction_id: transactionId,
      value,
      currency,
      ticket_quantity: ticketQuantity,
      ticket_type: ticketType,
      ecommerce: {
        currency,
        transaction_id: transactionId,
        ticket_quantity: ticketQuantity,
        ticket_type: ticketType,
        value,
      },
    });
  }, [currency, ticketQuantity, ticketType, transactionId, value]);

  return null;
}
