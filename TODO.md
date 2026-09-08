# Beks Battalion Site TODO

## Completed

- [x] Add the Beks Battalion logo beside the hero headline.
- [x] Add the warm Joy Tence carousel portrait with improved zoom and Joy Stage logo sizing.
- [x] Add Canada and Australia social-proof videos with the current headlines `Canada and Australia Sold Out Show` and `Next Stop USA`.
- [x] Add full-screen video playback and full-screen photo gallery viewing.
- [x] Make printed tickets print one ticket per page.
- [x] Reduce printed QR output size to improve printer spooling time.
- [x] Add a secure, signed SVIP upgrade link for paid GA/VIP orders.
- [x] Preserve the customer’s existing seats during an upgrade.
- [x] Charge the SVIP price difference plus the existing processing-fee rule through Stripe Checkout.
- [x] Fulfill upgrades only after a verified paid Stripe webhook event.
- [x] Add upgrade links to the paid receipt page and customer receipt email.
- [x] Make upgraded ticket verification use the current database tier.
- [x] Add an email-first customer-support `Contact Us` page and inquiry form.
- [x] Add Contact Us CTAs to the header, hero ticket card, and footer.

## Pending Before Production

- [ ] Add a direct call CTA after the customer-support phone number is confirmed.
- [ ] Push the SVIP upgrade implementation (`193a3db`) to GitHub and Vercel production.
- [ ] Test one GA-to-SVIP upgrade in Stripe test mode.
- [ ] Test one VIP-to-SVIP upgrade in Stripe test mode.
- [ ] Test a multi-seat upgrade and confirm the original seats are preserved.
- [ ] Confirm the Stripe webhook marks the order SVIP only after payment succeeds.
- [ ] Refresh the upgrade confirmation page and verify it does not duplicate the upgrade.
- [ ] Verify the customer email contains a working signed upgrade link.
- [ ] Verify the live webhook endpoint receives upgrade checkout events after deployment.
- [ ] Test browser print preview and confirm each printable ticket occupies one page.

## Deployment Note

The print-ticket improvements, Beks Battalion headline logo, Joy Tence carousel update, and social-proof headline updates have been deployed previously. The secure SVIP upgrade flow is implemented locally but is not live until the pending deployment step is completed.
