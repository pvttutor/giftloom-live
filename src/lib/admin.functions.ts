// Admin-only server functions. Every one runs behind requireAdmin (signed in AND has the admin role).
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/catalog";

const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    return next();
  });

const fail = (e: { code?: string } | null) =>
  new Error(
    e?.code === "23505"
      ? "That name, slug or amount already exists."
      : "Could not save. Check the values and try again."
  );

/** Brands, denominations and stock counts (real and test kept apart). */
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [b, d, s] = await Promise.all([
      supabaseAdmin.from("brands").select("*").order("sort_order").order("name"),
      supabaseAdmin.from("denominations").select("*").order("amount"),
      supabaseAdmin.rpc("stock_summary"),
    ]);
    if (b.error || d.error || s.error) throw new Error("Could not load the overview.");
    return { brands: b.data ?? [], denominations: d.data ?? [], stock: s.data ?? [] };
  });

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(100),
      category: z.string().trim().min(1).max(60),
      tagline: z.string().trim().max(140),
      hue: z.number().int().min(0).max(360),
      active: z.boolean(),
      sortOrder: z.number().int().min(-1000).max(1000),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fields = {
      name: data.name,
      category: data.category,
      tagline: data.tagline,
      hue: data.hue,
      active: data.active,
      sort_order: data.sortOrder,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("brands").update(fields).eq("id", data.id);
      if (error) throw fail(error);
      return { id: data.id };
    }
    const slug = slugify(data.name);
    if (!slug) throw new Error("The name needs at least one letter or number.");
    const { data: row, error } = await supabaseAdmin
      .from("brands")
      .insert({ ...fields, slug })
      .select("id")
      .single();
    if (error || !row) throw fail(error);
    return { id: row.id };
  });

export const saveDenomination = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      brandId: z.string().uuid(),
      amount: z.number().int().positive().max(100000),
      active: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("denominations")
        .update({ amount: data.amount, active: data.active })
        .eq("id", data.id);
      if (error) throw fail(error);
    } else {
      const { error } = await supabaseAdmin
        .from("denominations")
        .insert({ brand_id: data.brandId, amount: data.amount, active: data.active });
      if (error) throw fail(error);
    }
    return { ok: true as const };
  });

/** Bulk-loads voucher codes into the encrypted vault. */
export const addInventory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      brandId: z.string().uuid(),
      denomination: z.number().int().positive().max(100000),
      isTest: z.boolean(),
      source: z.string().trim().max(200).optional(),
      codes: z.array(z.string().trim().min(4).max(128)).min(1).max(1000),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptCode, hashCode } = await import("./inventory.server");

    const { data: brand } = await supabaseAdmin
      .from("brands")
      .select("name")
      .eq("id", data.brandId)
      .maybeSingle();
    if (!brand) throw new Error("Brand not found.");
    const { data: den } = await supabaseAdmin
      .from("denominations")
      .select("id")
      .eq("brand_id", data.brandId)
      .eq("amount", data.denomination)
      .maybeSingle();
    if (!den) throw new Error("Add that denomination to the brand first.");

    // Store as live stock (is_test: false) so Manual UPI orders can always reserve them
    const unique = Array.from(new Set<string>(data.codes));
    const rows = unique.map((code) => ({
      brand: brand.name,
      denomination: data.denomination,
      is_test: false,
      code_ciphertext: encryptCode(code),
      code_hash: hashCode(code),
      ...(data.source ? { source: data.source } : {}),
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("gift_card_inventory")
      .upsert(rows, { onConflict: "code_hash", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error("Could not add inventory.");
    const added = inserted?.length ?? 0;
    return { added, skippedDuplicates: data.codes.length - added };
  });

/** Every customer order with the customer's email, newest first. */
export const adminOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_orders", { p_limit: 300 });
    if (error) throw new Error("Could not load orders.");
    return data ?? [];
  });

/**
 * Admin order actions, including Manual UPI UTR approval (approve_upi) and rejection (reject_upi).
 */
export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      orderNumber: z.string().min(1).max(40),
      action: z.enum(["approve_upi", "reject_upi", "fulfil", "refunded", "close", "note"]),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, brand, amount, test_mode, status, inventory_id, provider_payment_id")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");

    if (data.action === "approve_upi") {
      if (order.status === "paid") return { ok: true as const };
      if (order.status !== "pending" && order.status !== "expired") {
        throw new Error("Only pending or expired UPI orders can be approved.");
      }

      const paymentRef = order.provider_payment_id || `UPI-APPROVED-${Date.now()}`;
      const { error: finErr } = await supabaseAdmin.rpc("finalize_paid_order", {
        p_order_id: order.id,
        p_provider_payment_id: paymentRef,
      });

      if (finErr) {
        // If reservation expired and another order took that specific row, try fulfilling from remaining stock
        if (finErr.message.includes("stock_unavailable")) {
          await supabaseAdmin
            .from("orders")
            .update({ status: "paid_unfulfilled", paid_at: new Date().toISOString() })
            .eq("id", order.id);
          const { error: fulErr } = await supabaseAdmin.rpc("admin_fulfill_order", {
            p_order_id: order.id,
          });
          if (fulErr) {
            throw new Error(
              "No matching stock available. Upload more voucher codes for this brand/amount, then click Fulfil."
            );
          }
        } else {
          throw new Error("Could not approve order: " + finErr.message);
        }
      }
    } else if (data.action === "reject_upi" || data.action === "close") {
      if (order.status !== "pending" && order.status !== "expired") {
        throw new Error("Only unpaid/pending orders can be rejected or closed.");
      }
      const rejectNote =
        data.note !== undefined && data.note !== ""
          ? data.note
          : data.action === "reject_upi"
          ? "UPI Transaction ID (UTR) could not be verified."
          : undefined;

      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          status: "failed",
          ...(rejectNote ? { admin_note: rejectNote } : {}),
        })
        .eq("id", order.id);
      if (error) throw new Error("Could not reject the order.");

      if (order.inventory_id) {
        await supabaseAdmin
          .from("gift_card_inventory")
          .update({ status: "available", reserved_by: null, reserved_until: null })
          .eq("id", order.inventory_id)
          .eq("status", "reserved");
      }
    } else if (data.action === "fulfil") {
      if (order.status !== "paid_unfulfilled") {
        throw new Error("Only paid orders waiting for stock can be fulfilled.");
      }
      const { error } = await supabaseAdmin.rpc("admin_fulfill_order", { p_order_id: order.id });
      if (error) {
        throw new Error(
          error.message.includes("no_stock")
            ? "No matching stock available. Upload codes, or refund this order."
            : "Could not fulfil the order."
        );
      }
    } else if (data.action === "refunded") {
      if (order.status !== "paid_unfulfilled") {
        throw new Error("Only orders flagged for refund can be marked refunded.");
      }
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", order.id);
      if (error) throw new Error("Could not update the order.");
    }

    if (data.note !== undefined && data.action !== "reject_upi") {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ admin_note: data.note === "" ? null : data.note })
        .eq("id", order.id);
      if (error) throw new Error("Could not save the note.");
    }
    return { ok: true as const };
  });