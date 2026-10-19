# Giftloom

An online store for digital gift cards. Customers pick a brand and amount, pay through a payment gateway, and receive their code as soon as the payment is verified. Built with Lovable and Claude; this folder is the source.

> **Status of this export:** the production build, the SQL migrations and the full app have not been run in the environment that packaged this ZIP. Run the checks in "Go-live checklist" before taking real money. See `MISSING_FILES.md` for files that could not be exported.

## Stack
- TanStack Start (React 19, file-based routing, SSR) with Vite and Nitro
- TypeScript, Tailwind CSS v4, shadcn/ui (Radix), motion
- Supabase (Postgres, Auth, row-level security) via `@supabase/supabase-js`
- Razorpay for payments (test mode first); AES-256-GCM encryption for stored voucher codes
- Vitest + Testing Library for tests

## Structure
- `src/routes/` pages: home, catalog, checkout, pay.success, login, my-cards, support, feedback, contact, legal, admin
- `src/lib/*.functions.ts` server functions (catalog, orders, admin); `src/lib/*.server.ts` server-only code (encryption, payments, order fulfillment)
- `src/routes/api.razorpay-webhook.ts` payment webhook endpoint (`POST /api/razorpay-webhook`)
- `src/integrations/supabase/` Supabase clients and generated types
- `drizzle/migrations/` SQL migrations, run in order: `0000` base schema, `0001` inventory vault and orders, `0002` brands, denominations and test stock, `0003` admin hardening, `0004` order management
- `scripts/load-inventory.mjs` bulk code loader (optional; the Admin screen does the same)
- `docs/INVENTORY_AND_PAYMENTS.md` how stock and payments work

## Prerequisites
- Node.js 22.18 or newer (the upload script runs TypeScript directly; the app itself needs Node 20+) and npm or Bun
- A Supabase project
- A Razorpay account (test mode needs no KYC; live mode does)

## 1. Database
1. In the Supabase SQL editor, run `0000_giftloom_schema.sql`, `0001_real_inventory.sql`, `0002_catalog_and_test_stock.sql`, `0003_harden_admin.sql` and `0004_order_management.sql`, in that order. (`drizzle/all-migrations.sql` is all of them in one file; replace the email in its last block with yours.)
2. Authentication, Providers: enable Email and **turn email confirmation ON**. Under URL Configuration set the Site URL to your domain and add `https://<your-domain>/**` to Redirect URLs; confirmation and password-reset links need it. Supabase's built-in email sender is rate-limited and meant for testing, so set up custom SMTP before launch. The app handles sign up, the "check your inbox" step with resend, sign in, sign out, password reset (`/reset-password`) and the email confirmation landing page (`/auth/confirmed`).
3. **Nobody becomes admin automatically.** Sign up on the site, then run `select public.grant_admin('you@yourdomain.com');` in the SQL editor. If the site was ever public before migration 0003, run the audit query at the bottom of that file and revoke anyone unexpected. Turn on MFA for admin accounts in Supabase.
4. Set `project_id` in `supabase/config.toml` to your own project ref.

Backups: Supabase dashboard backups, or `pg_dump "<connection string>" > backup.sql`. Back up `INVENTORY_ENCRYPTION_KEY` separately; without it stored codes cannot be read.

## 2. Environment variables
Copy `.env.example` to `.env`. Never commit real values.

| Variable | Where | Secret? |
| --- | --- | --- |
| VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY | browser, build time | no |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | server | no |
| SUPABASE_SERVICE_ROLE_KEY | server only | YES |
| INVENTORY_ENCRYPTION_KEY (`openssl rand -base64 32`) | server only | YES |
| RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | server | secret is YES |
| RAZORPAY_WEBHOOK_SECRET (a secret you choose in the Razorpay webhook settings; not the API secret) | server only | YES |
| ALLOW_LIVE_PAYMENTS (`false` until you go live) | server | no |
| DATABASE_URL | drizzle-kit only | YES |

`rzp_test_` keys switch the whole site into **Sandbox Test Mode** (a banner appears automatically and only test stock is sold). `rzp_live_` keys are refused unless `ALLOW_LIVE_PAYMENTS=true`.

## 3. Run, build, deploy
```sh
npm install
npm run dev
npm test
npm run build
```
`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which builds Nitro for a Cloudflare target by default; for another host you will probably need a different Nitro preset (for example `NITRO_PRESET=vercel`). Untested. Set every environment variable on the host and add its URL to Supabase, Authentication, URL Configuration.

## 4. Running the store (Admin)
1. Sign in as the admin and open `/admin`. Orders tab: every customer order with email, status and gateway ids; add notes; for a paid order whose voucher was lost, fulfil it from stock or mark it refunded (after refunding in Razorpay); close stuck unpaid orders. Orders can never be marked paid by hand.
2. Brands tab: add a brand and its denominations.
2. Upload codes. **Test codes** (made-up) are sold only under test keys; **real codes** only under live keys. Customers see only in stock or out of stock; you see exact counts in the Stock tab.
3. With `rzp_test_` keys, buy a card using Razorpay's test credentials (UPI `success@razorpay`) and check the full flow.

## Go-live checklist
- All three migrations ran; `npm run build` and `npm test` pass on your machine.
- A full test purchase works, including a failed payment and an out-of-stock item.
- Configure the webhook: Razorpay Dashboard, Settings, Webhooks. URL `https://<your-domain>/api/razorpay-webhook`, events `payment.captured` (and optionally `order.paid`), and a secret of your choice, the same value as `RAZORPAY_WEBHOOK_SECRET`. Then test: pay, close the tab immediately, and confirm the order still completes.
- Source codes only from a licensed distributor or direct brand agreement, under a written contract.
- Confirm your gateway permits gift card sales and approve live keys; then set live keys and `ALLOW_LIVE_PAYMENTS=true`.
- Review `src/routes/legal.tsx` and the support FAQ against your real policies, ideally with legal advice.
- Refunds for `paid_unfulfilled` orders are manual in the gateway dashboard.

## Lovable-specific parts
| Item | Plan |
| --- | --- |
| `@lovable.dev/vite-tanstack-config` (build wrapper) | Works if installable from npm (unverified). To drop it, write an explicit Vite config with TanStack Start, React, Tailwind, path aliases and Nitro. |
| `bunfig.toml`, `.lovable/project.json`, `AGENTS.md` Lovable block | Delete if you stop syncing with Lovable |
| `previewAuthStorage.ts`, `lovable-error-reporting.ts` | Only act inside Lovable's editor preview; harmless elsewhere |
| `src/integrations/supabase/*` | Works with any Supabase project |
| Lovable Cloud backend | Replace with your own Supabase project; data is not exported |
