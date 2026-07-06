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
