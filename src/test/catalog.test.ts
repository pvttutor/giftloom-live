import { describe, expect, it } from "vitest";
import { brandArt, categoriesOf, filterCatalog, flattenCatalog, safeRedirect, slugify, type CatalogBrand } from "../lib/catalog";

const brands: CatalogBrand[] = [
  { slug: "alpha", name: "Alpha", category: "Food", tagline: "", hue: 10, denominations: [{ amount: 500, inStock: true }, { amount: 1000, inStock: false }] },
  { slug: "beta", name: "Beta", category: "Games", tagline: "", hue: 20, denominations: [{ amount: 250, inStock: true }] },
];

describe("catalog helpers", () => {
  const items = flattenCatalog(brands);
  it("flattens brands into one item per denomination and keeps stock flags", () => {
    expect(items.map((i) => i.id)).toEqual(["alpha-500", "alpha-1000", "beta-250"]);
    expect(items.find((i) => i.id === "alpha-1000")?.inStock).toBe(false);
  });
  it("lists categories once", () => {
    expect(categoriesOf(brands)).toEqual(["Food", "Games"]);
  });
  it("filters by category and amount", () => {
    expect(filterCatalog(items, { category: "Games" }).map((i) => i.id)).toEqual(["beta-250"]);
    expect(filterCatalog(items, { amount: 1000 }).map((i) => i.id)).toEqual(["alpha-1000"]);
  });
  it("sorts by price", () => {
    expect(filterCatalog(items, { sort: "price-desc" })[0]?.amount).toBe(1000);
    expect(filterCatalog(items, { sort: "price-asc" })[0]?.amount).toBe(250);
  });
  it("builds slugs and fallback art", () => {
    expect(slugify("Page & Pine!")).toBe("page-pine");
    expect(brandArt("Gone Brand").hue).toBe(262);
  });
  it("rejects off-site redirects", () => {
    expect(safeRedirect("//evil.com")).toBe("/my-cards");
    expect(safeRedirect("/checkout?brand=x")).toBe("/checkout?brand=x");
  });
});
