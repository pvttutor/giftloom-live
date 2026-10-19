// Types and pure helpers. The catalog itself lives in the database (see catalog.functions.ts).
export type Brand = { slug: string; name: string; category: string; tagline: string; hue: number };
export type CatalogDenomination = { amount: number; inStock: boolean };
export type CatalogBrand = Brand & { denominations: CatalogDenomination[] };
export type CatalogItem = { id: string; brand: Brand; amount: number; inStock: boolean };
export type SortOrder = "featured" | "price-asc" | "price-desc";

export const FALLBACK_HUE = 262;

/** Card artwork for a brand known only by name (e.g. an old order whose brand was later removed). */
export function brandArt(name: string, hue?: number | null): Brand {
  return { slug: "", name, category: "", tagline: "", hue: hue ?? FALLBACK_HUE };
}

export function flattenCatalog(brands: CatalogBrand[]): CatalogItem[] {
  return brands.flatMap(({ denominations, ...brand }) =>
    denominations.map((d) => ({ id: `${brand.slug}-${d.amount}`, brand, amount: d.amount, inStock: d.inStock })),
  );
}

export const categoriesOf = (brands: CatalogBrand[]) => Array.from(new Set(brands.map((b) => b.category)));

export function filterCatalog(
  items: CatalogItem[],
  opts: { category?: string | null; amount?: number | null; sort?: SortOrder },
): CatalogItem[] {
  let out = items.filter(
    (i) => (!opts.category || i.brand.category === opts.category) && (!opts.amount || i.amount === opts.amount),
  );
  if (opts.sort === "price-asc") out = [...out].sort((a, b) => a.amount - b.amount);
  if (opts.sort === "price-desc") out = [...out].sort((a, b) => b.amount - a.amount);
  return out;
}

export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Sanitize a post-login redirect to a same-origin path. */
export function safeRedirect(r: unknown): string {
  return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : "/my-cards";
}
