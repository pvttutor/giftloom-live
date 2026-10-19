import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CardFace } from "@/components/GiftCard";
import { PageHeader } from "@/components/SiteChrome";
import { listMyCards } from "@/lib/orders.functions";
import { brandArt, formatINR } from "@/lib/catalog";
import { requireUser } from "@/lib/require-auth";

export const Route = createFileRoute("/my-cards")({
  ssr: false,
  beforeLoad: ({ location }) => requireUser(location.href),
  head: () => ({
    meta: [
      { title: "My cards — Giftloom" },
      { name: "description", content: "Your gift card orders and codes." },
      { property: "og:title", content: "My cards — Giftloom" },
      { property: "og:description", content: "Your orders." },
    ],
  }),
  component: MyCards,
});

function MyCards() {
  const { data: orders, isLoading } = useQuery({ queryKey: ["my-cards"], queryFn: () => listMyCards() });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="My cards" subtitle="Only you can see these. Keep your codes private." />
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {orders?.length === 0 && (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground">No cards yet.</p>
          <Button asChild className="mt-4"><Link to="/catalog">Find your first card</Link></Button>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {orders?.map((o, i) => {
          const brand = brandArt(o.brand, o.hue);
          return (
            <motion.div key={o.order_number} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl border bg-card p-4">
              <CardFace brand={brand} amount={o.amount} />
              <div className="mt-4 space-y-1 text-sm">
                <p className="flex justify-between"><span className="text-muted-foreground">Code</span><span className="font-mono font-bold">{o.code ?? "—"}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Order</span><span className="font-mono">{o.order_number}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{formatINR(o.amount)} · {o.status}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(o.created_at).toLocaleDateString()}</span></p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
