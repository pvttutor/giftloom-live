<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Giftloom: engineering guidelines

Giftloom sells digital gift card codes. Treat voucher codes and payment flow as sensitive.

## Architecture
- TanStack Start + Supabase. Server functions live in `src/lib/*.functions.ts`; secrets and server-only logic in `src/lib/*.server.ts`, imported dynamically inside handlers.
- Catalog (brands, denominations) is in the database. Stock lives in `gift_card_inventory`; codes are AES-256-GCM encrypted (`inventory.server.ts`) and are never stored or logged in plaintext.
- Migrations in `drizzle/migrations/` run in numeric order. Add new ones; do not edit old ones.

## Rules
1. Orders are created and changed only on the server. Never add a client-side insert or update on `orders` or `gift_card_inventory`.
2. A sale needs a verified payment: signature check with the stored gateway order id, gateway status `captured`, matching order and amount, then `finalize_paid_order`.
3. Test and real stock stay separate (`is_test`). Test keys must never sell or reveal real codes.
4. Admin actions go through `requireAdmin` in `admin.functions.ts`. The admin role is granted only with `select public.grant_admin(...)` in the SQL editor; never assign it automatically.
5. The "Sandbox Test Mode" banner (`TestModeBanner` in `SiteChrome.tsx`) must show whenever test keys are in use. Do not remove or hide it.
6. Live keys must stay behind `ALLOW_LIVE_PAYMENTS=true`.
7. Never commit secrets. `.env.example` lists variable names only.
8. The browser confirmation and the Razorpay webhook must both finish orders through `finalizePaidOrder` in `fulfillment.server.ts`. Keep it that way, and keep the webhook signature check on the raw body.
9. Admin order actions go through `updateOrder` / `admin_fulfill_order`. An order may never be marked paid without a verified payment or real stock assigned to an already-paid order.
