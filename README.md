# Beks Battalion Next.js page

This is a small Next.js `app/` router scaffold for the Beks Battalion landing page.

## Files
- `app/page.tsx` - the landing page UI
- `app/layout.tsx` - metadata and fonts
- `app/globals.css` - all visual styling
- `public/assets/webdesign-idea.png` - poster image used in the hero and venue sections

## Run it
```bash
npm install
npm run dev
```

If you place these files into a fresh Next.js app, the design should render as a three-section scrolling page.

## Environment variables
Add these in Vercel so the inquiry form can send email and Meta Lead events:

- `RESEND_API_KEY`
- `META_PIXEL_ID` (optional, defaults to the current pixel ID)
- `META_CAPI_ACCESS_TOKEN`
- `META_TEST_EVENT_CODE` (optional, for Meta test events)

The inquiry form will keep working even if Meta CAPI is unavailable, but the Lead event will only be sent when the Meta token is configured.

## Ticketing draft
An isolated electronic ticketing flow now lives in these routes:

- `/tickets` - ticket selection and Stripe Checkout handoff
- `/api/tickets/checkout` - reserved-seat checkout with seat holds and Stripe Checkout
- `/api/tickets/tier-checkout` - test-only tier checkout without seat assignment
- `/api/tickets/admin/block` - admin-only seat block and unblock endpoint for pre-reserved seats
- `/api/tickets/admin/issue` - admin-only sponsor and comp ticket issuance for already blocked seats
- `/api/tickets/admin/reassign` - admin-only reserved-seat reassignment endpoint
- `/tickets/admin` - admin seat blackout controls
- `/tickets/admin/issue` - admin sponsor and comp ticket issue flow
- `/tickets/admin/issued?order_id=...` - printable admin-issued ticket page
- `/tickets/confirmation?session_id=...` - print-ready ticket page after payment
- `/tickets/verify?ticket=...` - signed QR verification page

Required environment variables for the ticketing flow:

- `DATABASE_URL` (required for reserved-seat checkout, paid seat persistence, and admin reassignment)
- `TICKET_CHECKOUT_ENABLED=true` (only set this when you want the `/api/tickets/checkout` route to create real Checkout Sessions; default is paused/off)
- `TICKET_TIER_TEST_CHECKOUT_ENABLED=true` (enables the safer test-only tier checkout route)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (recommended for reliable live fulfillment and post-payment handling)
- `STRIPE_TAX_ENABLED=true` (optional, enables Stripe Tax on ticket checkout and adds tax on top of the ticket price)
- `STRIPE_TAX_EVENT_LOCATION_ID` (optional override for a pre-created Stripe performance location; if omitted, the app creates one from the venue address at runtime)
- `STRIPE_TICKET_TAX_CODE` (optional, defaults to `txcd_50010001` for venue admission tickets)
- `TICKET_SIGNING_SECRET` (required in production for QR verification signatures)
- `TICKET_ADMIN_SECRET` (optional, enables the admin reassignment endpoint)
- `TICKET_HOLD_MINUTES` (optional, defaults to 30 and is clamped to Stripe Checkout’s 30-60 minute seat-hold window)
- `NEXT_PUBLIC_SITE_URL` (recommended so Stripe success/cancel URLs point to the correct domain)
- `TWILIO_ACCOUNT_SID` (optional, required if you want ticket SMS delivery for paid or admin-issued orders)
- `TWILIO_AUTH_TOKEN` (optional, required if you want ticket SMS delivery for paid or admin-issued orders)
- `TWILIO_FROM_NUMBER` (optional, use this or `TWILIO_MESSAGING_SERVICE_SID` for ticket SMS delivery)
- `TWILIO_MESSAGING_SERVICE_SID` (optional alternative to `TWILIO_FROM_NUMBER` for ticket SMS delivery)

Notes:

- The landing page is not linked to the ticketing draft yet.
- Payments are intentionally paused unless `TICKET_CHECKOUT_ENABLED=true` is present.
- The safer tier-only test flow requires `TICKET_TIER_TEST_CHECKOUT_ENABLED=true` and a Stripe test key such as `sk_test_...` or `rk_test_...`.
- Stripe Tax is gated behind `STRIPE_TAX_ENABLED=true` so checkout does not fail before tax registrations are configured in Stripe.
- The current event performance location is `1250 Olympic Parkway, Chula Vista, CA 91913, US`, and ticket tax is configured as exclusive so tax is added on top of the listed price.
- Checkout now adds a separate 3% processing fee line item on top of the ticket subtotal in both reserved-seat checkout and the test tier-only checkout flow.
- The ticket page now discloses that 3% processing fee before payment and Stripe Checkout itemizes it as a separate line item.
- Reserved-seat checkout now requires Postgres-backed seat holds, fulfilled tickets, and webhook reconciliation before live payments.
- The admin reassignment route expects either `Authorization: Bearer <TICKET_ADMIN_SECRET>` or `X-Ticket-Admin-Secret: <TICKET_ADMIN_SECRET>`.
- The admin block route accepts `POST` to block seats and `DELETE` to unblock seats using the same admin secret header pattern.
- The admin issue route accepts `POST` to convert already blocked seats into printable sponsor or comp tickets without Stripe Checkout.
- The admin text route accepts `POST` to send the printable sponsor or comp pass link by SMS using the stored or newly entered recipient phone number.
- Paid reserved-seat Stripe orders now attempt automatic SMS delivery after successful webhook fulfillment when Twilio is configured and the purchaser phone number is available.
- The admin block payload shape is:

```json
{
  "actorLabel": "Joy Stage Admin",
  "seatLabels": ["SA1-1", "SA1-2", "SB1-1"],
  "notes": "Sponsor and family hold"
}
```

- The admin issue payload shape is:

```json
{
  "actorLabel": "Sponsor - John DeLeon",
  "purchaserName": "John DeLeon",
  "purchaserEmail": "john@example.com",
  "purchaserPhone": "555-555-5555",
  "seatLabels": ["SB1-5", "SB1-6", "SB1-7", "SB1-8"],
  "notes": "Sponsor admission passes"
}
```

- The admin reassignment payload shape is:

```json
{
  "actorLabel": "Joy Stage Admin",
  "checkoutSessionId": "cs_live_or_test_...",
  "ticketIndex": 1,
  "newSeatLabel": "SA2-4",
  "notes": "Manual move for VIP guest"
}
```

- This version verifies paid Stripe sessions and generates signed QR ticket links, and reserved-seat confirmations now read current seat assignments from the database.
- Live Stripe webhook endpoint path: `/api/tickets/webhook`
- Subscribe the webhook to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
