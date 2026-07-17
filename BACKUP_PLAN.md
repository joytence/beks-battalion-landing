# Joy Stage Productions Site Backup Plan

This document explains how to protect and restore the Joy Stage Productions / Beks Battalion website if something goes wrong.

Live site:

https://www.joystageproductions.com

Vercel project:

`beks-battalion-landing`

GitHub repository:

`https://github.com/joytence/beks-battalion-landing`

Local project path:

`/Users/adminjsp/Documents/Codex/2026-06-30/i-actually-like-this-design-but/outputs/nextjs-beks-battalion`

## What Needs To Be Backed Up

This site has several parts. A full backup is not just one file.

1. Website code
2. Vercel deployments and environment settings
3. Production database
4. Stripe settings and webhooks
5. Resend email settings
6. Domain and DNS settings
7. Sponsor logos and other public assets

## 1. Code Backup

The main code backup is GitHub.

Before and after every meaningful change:

```bash
git status
git add .
git commit -m "Describe the change"
git push origin main
```

Use `git status` first so unrelated local files are not accidentally committed.

Do not commit secrets, `.env.local`, database URLs, API keys, or passwords.

## 2. Vercel Rollback Backup

Vercel keeps previous production deployments.

If the live site breaks after a deploy:

1. Open Vercel.
2. Go to project `beks-battalion-landing`.
3. Open `Deployments`.
4. Find the last known good production deployment.
5. Use rollback or promote that deployment back to production.

This is the fastest emergency recovery option for website-code problems.

## 3. Database Backup

The production database stores ticketing activity, including orders, seat holds, issued tickets, and admin actions.

Important tables:

```text
ticket_orders
ticket_seat_holds
ticket_tickets
ticket_admin_audit
```

Before major ticketing changes or event-day operations:

1. Open the database provider, likely Neon/Postgres.
2. Create a manual backup or snapshot.
3. Label it clearly, for example:

```text
Before ticket admin changes - YYYY-MM-DD
Before event day - YYYY-MM-DD
```

Keep at least one clean backup from before the event.

## 4. Environment Variable Backup

Environment variables are stored in:

Vercel Project Settings > Environment Variables

Keep a private list of which variables exist, but do not paste secret values into chat or public docs.

Expected sensitive variables include:

```text
DATABASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
TICKET_ADMIN_SECRET
RESEND_API_KEY
```

Other Postgres-related variables may also exist in Vercel.

Do not store secret values inside this repository unless they are in ignored local files such as `.env.local`.

## 5. Stripe Backup

Stripe controls checkout and webhook delivery.

Record these settings privately:

```text
Stripe account used for Joy Stage Productions
Live webhook endpoint URL
Test webhook endpoint URL, if used
Webhook events enabled
Current live/test mode status
```

The live webhook endpoint should point to:

```text
https://www.joystageproductions.com/api/tickets/webhook
```

Do not store Stripe secret keys in GitHub or normal notes.

## 6. Resend Email Backup

Resend controls ticket/admin email sending.

Record privately:

```text
Resend account
Verified sending domain
Sender email address
Where RESEND_API_KEY is stored
```

Do not store the Resend API key in this file.

## 7. Domain And DNS Backup

The public site depends on the custom domain:

```text
www.joystageproductions.com
```

Record privately:

```text
Domain registrar
DNS provider
Vercel domain settings
Any required CNAME or A records
```

Take screenshots of the DNS records after any DNS change.

## 8. Public Asset Backup

Sponsor logos, performer photos, and site images are stored in:

```text
public/assets
```

These should be committed to GitHub when they are used by the website.

Keep original sponsor logo files in Google Drive as an additional backup.

## Quick Emergency Restore Checklist

If the site breaks:

1. Check Vercel Deployments.
2. Roll back to the last known good production deployment.
3. Confirm `https://www.joystageproductions.com` loads.
4. If ticket data looks wrong, stop making ticket changes and check the latest database backup.
5. If checkout fails, check Stripe webhook health and Vercel environment variables.
6. If emails fail, check Resend domain/API status and Vercel environment variables.

## Before Major Changes

Use this checklist before sponsor, ticketing, checkout, or database changes:

```text
[ ] GitHub has the latest working code.
[ ] Current Vercel production deployment is known.
[ ] Database backup/snapshot has been created.
[ ] No secret values are being pasted into chat or committed.
[ ] Stripe mode is understood: test or live.
[ ] After deployment, live site and ticket checkout are tested.
```

## Recommended Routine

Weekly:

```text
Push latest code to GitHub.
Confirm Vercel has a recent successful production deployment.
Confirm database automatic backups are enabled.
```

Before event day:

```text
Create a manual database backup.
Confirm Stripe checkout works.
Confirm ticket admin pages work.
Confirm email sending works.
Record the current Vercel production deployment ID.
```

After event day:

```text
Create a final database backup.
Export any reports needed for records.
Do not delete old deployments or database snapshots until all ticketing records are reconciled.
```
