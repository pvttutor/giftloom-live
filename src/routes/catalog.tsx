import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardFace, GiftCard } from "@/components/GiftCard";
import { PageHeader } from "@/components/SiteChrome";
import { categoriesOf, filterCatalog, flattenCatalog, formatINR, type CatalogItem, type SortOrder } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/catalog")({
  validateSearch: z.object({ category: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Catalog — Giftloom" },
      { name: "description", content: "Browse digital gift cards by brand and amount. Filter, sort and preview cards." },
      { property: "og:title", content: "Giftloom catalog" },
      { property: "og:description", content: "Browse digital gift cards by brand and amount." },
    ],
  }),
  component: Catalog,
});

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
      {children}
    </button>
  );
}

function Catalog() {
  const { category: initialCat } = Route.useSearch();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string | null>(initialCat ?? null);
  const [amount, setAmount] = useState<string>("all");
  const [sort, setSort] = useState<SortOrder>("featured");
  const [preview, setPreview] = useState<CatalogItem | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog() });
  const all = useMemo(() => flattenCatalog(data?.brands ?? []), [data]);
  const categories = useMemo(() => categoriesOf(data?.brands ?? []), [data]);
  const amounts = useMemo(() => Array.from(new Set<number>(all.map((i) => i.amount))).sort((a, b) => a - b), [all]);
  const items = useMemo(
    () => filterCatalog(all, { category, amount: amount === "all" ? null : Number(amount), sort }),
    [all, category, amount, sort],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="Catalog" subtitle="Pick a brand and an amount. Items without stock are marked and cannot be bought." />
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {isError && <p role="alert" className="text-destructive">We couldn't load the catalog. Please refresh.</p>}
      {data && all.length === 0 && <p className="py-12 text-center text-muted-foreground">The catalog is being stocked. Please check back soon.</p>}

      {all.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip active={!category} onClick={() => setCategory(null)}>All</Chip>
            {categories.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}
          </div>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:flex">
            <Select value={amount} onValueChange={setAmount}>
              <SelectTrigger className="sm:w-44" aria-label="Amount"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any amount</SelectItem>
                {amounts.map((a) => <SelectItem key={a} value={String(a)}>{formatINR(a)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
              <SelectTrigger className="sm:w-48" aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <motion.div layout className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.button
                  key={item.id} layout type="button"
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  whileHover={{ y: -8 }}
                  onClick={() => setPreview(item)}
                  className="group rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                >
                  <div className="relative">
                    <CardFace brand={item.brand} amount={item.amount}
                      className={cn("shadow-card transition-shadow group-hover:shadow-lift", !item.inStock && "opacity-50 grayscale")} />
                    {!item.inStock && <Badge variant="destructive" className="absolute right-3 top-3">Out of stock</Badge>}
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1 text-sm">
                    <span className="font-semibold">{item.brand.name}</span>
                    <span className="text-muted-foreground">{item.brand.category}</span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
          {items.length === 0 && <p className="py-12 text-center text-muted-foreground">No cards match those filters.</p>}
        </>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          {preview && (
            <>
              <DialogTitle className="font-display text-2xl">{preview.brand.name}</DialogTitle>
              <DialogDescription>{preview.brand.tagline || preview.brand.category}. Tap the card to flip it.</DialogDescription>
              <GiftCard brand={preview.brand} amount={preview.amount} interactive />
              <div className="flex items-center justify-between">
                <span className="font-display text-2xl font-extrabold">{formatINR(preview.amount)}</span>
                <Button disabled={!preview.inStock}
                  onClick={() => navigate({ to: "/checkout", search: { brand: preview.brand.slug, amount: preview.amount } })}>
                  {preview.inStock ? "Buy now" : "Out of stock"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
