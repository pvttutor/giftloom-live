// Customer-facing server functions. Secrets and the vault only ever run inside the handlers.
// Heavy/secret modules are imported dynamically inside handlers, never at top level.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public. Returns live mode (testMode: false) for Manual UPI QR checkout so no sandbox banner is shown. */
export const getPaymentMode = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: true, testMode: false };
});

/** Submits a Manual UPI QR order with the customer's 12-digit UPI Transaction ID (UTR). */
export const submitUpiOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      brand: z.string().min(1).max(100),
      amount: z.number().int().positive(),
      utr: z.string().trim().regex(/^\d{12}$/, "Invalid 12-digit UTR"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Check if this 12-digit UTR was already submitted on another order
    const { data: existingUtr } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("provider_payment_id", data.utr)
      .maybeSingle();

    if (existingUtr) {
      return { ok: false as const, reason: "duplicate_utr" as const };
    }

    // 2. Verify brand & denomination are active
    const { data: brand } = await supabaseAdmin
      .from("brands")
      .select("id, name")
      .eq("slug", data.brand)
      .eq("active", true)
      .maybeSingle();
    if (!brand) return { ok: false as const, reason: "unknown_item" as const };

    const { data: den } = await supabaseAdmin
      .from("denominations")
      .select("id")
      .eq("brand_id", brand.id)
      .eq("amount", data.amount)
      .eq("active", true)
      .maybeSingle();
    if (!den) return { ok: false as const, reason: "unknown_item" as const };

    // 3. Reserve 1 available voucher for 24 hours (1440 mins) while awaiting Admin UPI verification
    let { data: inventoryId, error: rErr } = await supabaseAdmin.rpc("reserve_inventory", {
      p_user: context.userId,
      p_brand: brand.name,
      p_denom: data.amount,
      p_test: false,
      p_minutes: 1440,
    });

    // Fallback: if admin uploaded stock while in test mode (is_test = true), check that pool if live pool is empty
    if (!rErr && !inventoryId) {
      const fallback = await supabaseAdmin.rpc("reserve_inventory", {
        p_user: context.userId,
        p_brand: brand.name,
        p_denom: data.amount,
        p_test: true,
        p_minutes: 1440,
      });
      inventoryId = fallback.data;
      rErr = fallback.error;
    }

    if (rErr) {
      if (rErr.message.includes("too_many_reservations")) {
        return { ok: false as const, reason: "too_many_pending" as const };
      }
      throw new Error("Could not reserve stock.");
    }
    if (!inventoryId) return { ok: false as const, reason: "out_of_stock" as const };

    const release = () =>
      supabaseAdmin
        .from("gift_card_inventory")
        .update({ status: "available", reserved_by: null, reserved_until: null })
        .eq("id", inventoryId)
        .eq("status", "reserved");

    // 4. Create the order in 'pending' status with the customer's 12-digit UTR stored in provider_payment_id
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: context.userId,
        brand: brand.name,
        amount: data.amount,
        inventory_id: inventoryId,
        status: "pending",
        provider: "upi_manual",
        provider_order_id: `UPI-${data.utr}`,
        provider_payment_id: data.utr,
        test_mode: false,
      })
      .select("id, order_number")
      .single();

    if (oErr || !order) {
      await release();
      if (oErr?.message?.includes("unique") || oErr?.code === "23505") {
        return { ok: false as const, reason: "duplicate_utr" as const };
      }
      throw new Error("Could not create the order.");
    }

    return {
      ok: true as const,
      orderNumber: order.order_number,
    };
  });

/** Legacy gateway starter kept so existing imports/tests continue to resolve. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ brand: z.string().min(1).max(100), amount: z.number().int() }))
  .handler(async () => {
    return { ok: false as const, reason: "unknown_item" as const };
  });

/** Legacy gateway confirmation kept so existing imports/tests continue to resolve. */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orderNumber: z.string().min(1).max(40),
      paymentId: z.string().min(1).max(100),
      signature: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("order_number", data.orderNumber)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!order) return { ok: false as const, reason: "order_not_found" as const };
    if (order.status === "paid") return { ok: true as const };
    return { ok: false as const, reason: "not_captured" as const };
  });

/** The signed-in customer's orders. Codes are decrypted only for PAID orders they own. */
export const listMyCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptCode } = await import("./inventory.server");

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("order_number, brand, amount, status, created_at, inventory_id, provider_payment_id, admin_note")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load your cards.");

    const paidIds = orders.filter((o) => o.status === "paid" && o.inventory_id).map((o) => o.inventory_id as string);
    const codes = new Map<string, string>();
    if (paidIds.length > 0) {
      const { data: inv } = await supabaseAdmin
        .from("gift_card_inventory")
        .select("id, code_ciphertext")
        .in("id", paidIds);
      for (const r of inv ?? []) codes.set(r.id, decryptCode(r.code_ciphertext));
    }

    const names = Array.from(new Set(orders.map((o) => o.brand)));
    const hues = new Map<string, number>();
    if (names.length > 0) {
      const { data: bs } = await supabaseAdmin.from("brands").select("name, hue").in("name", names);
      for (const b of bs ?? []) hues.set(b.name, b.hue);
    }

    return orders.map((o) => ({
      order_number: o.order_number,
      brand: o.brand,
      hue: hues.get(o.brand) ?? null,
      amount: o.amount,
      status: o.status,
      created_at: o.created_at,
      utr: o.provider_payment_id ?? null,
      admin_note: o.admin_note ?? null,
      code: o.status === "paid" && o.inventory_id ? (codes.get(o.inventory_id) ?? null) : null,
    }));
  });