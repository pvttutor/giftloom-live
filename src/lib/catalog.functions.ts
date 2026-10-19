// Public storefront data. Exposes only "in stock or not", never exact counts.
import { createServerFn } from "@tanstack/react-start";
import type { CatalogBrand } from "@/lib/catalog";

export const getCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ testMode: boolean; brands: CatalogBrand[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPaymentConfig } = await import("./payments.server");
    let testMode = true;
    try {
      testMode = getPaymentConfig().testMode;
    } catch {
      /* payments not configured: show test stock only */
    }

    const [b, d, s] = await Promise.all([
      supabaseAdmin.from("brands").select("id, slug, name, category, tagline, hue").eq("active", true).order("sort_order").order("name"),
      supabaseAdmin.from("denominations").select("brand_id, amount").eq("active", true).order("amount"),
      supabaseAdmin.rpc("stock_summary"),
    ]);
    if (b.error || d.error || s.error) throw new Error("Could not load the catalog.");

    // Only stock matching the current mode counts: test keys see test stock, live keys see real stock.
    const available = new Map<string, number>();
    for (const r of s.data ?? []) if (r.is_test === testMode) available.set(`${r.brand}|${r.denomination}`, r.available);

    const brands = (b.data ?? [])
      .map((x) => ({
        slug: x.slug,
        name: x.name,
        category: x.category,
        tagline: x.tagline,
        hue: x.hue,
        denominations: (d.data ?? [])
          .filter((y) => y.brand_id === x.id)
          .map((y) => ({ amount: y.amount, inStock: (available.get(`${x.name}|${y.amount}`) ?? 0) > 0 })),
      }))
      .filter((x) => x.denominations.length > 0);
    return { testMode, brands };
  },
);
