# Inventory vault, catalog and payments

## Data model (migrations 0001 and 0002)
- `brands` and `denominations`: the catalog, edited in the Admin screen. A brand's slug (used in URLs) stays fixed when you rename it.
- `gift_card_inventory`: one row per voucher. Status `available` -> `reserved` -> `sold`. The code is stored encrypted (AES-256-GCM); a keyed hash blocks duplicate uploads. `is_test` separates sandbox codes from real ones. Browser roles cannot read this table.
- `orders`: created and updated only by the server. Statuses: `pending`, `paid`, `paid_unfulfilled`, `failed`, `expired`, `refunded`. `admin_note` holds the owner's notes.

## Stock rules
- The storefront shows only "in stock" or "out of stock", for the stock matching the current mode (test keys see test stock, live keys see real stock). Out-of-stock items cannot be bought, and the server checks again at checkout.
- `reserve_inventory()` locks one voucher atomically (`FOR UPDATE SKIP LOCKED`) for 20 minutes and caps a user at 3 unpaid reservations. Expired reservations are released and their orders marked `expired`.
- `finalize_paid_order()` marks the order paid and the voucher sold in one transaction, and refuses to cross test and real stock.

## Payment flow (Razorpay)
1. `startCheckout` reserves stock and creates the gateway order.
2. The browser opens Razorpay Checkout.
3. `confirmPayment` verifies the HMAC signature with the stored gateway order id, fetches the payment from the gateway and requires `captured`, the right order, amount and INR, then finalizes the order. Enable auto-capture in the Razorpay dashboard.
4. A paid order whose voucher is gone becomes `paid_unfulfilled`; refund it manually.
5. Webhook: `POST /api/razorpay-webhook` verifies the raw-body signature (`RAZORPAY_WEBHOOK_SECRET`), re-checks the payment with the gateway, then runs the same finalize step, so an order completes even if the browser tab was closed. The browser path and the webhook can run at the same time safely.

## Test then go live
1. Admin, Upload codes: load a few **test codes** for a brand. With `rzp_test_` keys, buy one (UPI `success@razorpay`; `failure@razorpay` fails).
2. Load **real codes** any time; they stay untouched until live keys are on.
3. Live: set `rzp_live_` keys and `ALLOW_LIVE_PAYMENTS=true`.

## Managing orders (Admin, Orders tab)
- `paid_unfulfilled` (customer paid, voucher lost): **Fulfil from stock** assigns another voucher of the same brand, amount and mode (`admin_fulfill_order`), or **Mark refunded** after you refund in the Razorpay dashboard.
- `pending` / `expired`: **Close unpaid order** marks it failed and releases the voucher.
- There is no action that marks an order paid by hand.

## Known gaps
- The webhook has not been exercised against a real Razorpay account. Test it in test mode: pay, close the tab immediately, and confirm the order still completes.
- No refund automation.
- Legal and FAQ text are defaults; make them match your real policies.
