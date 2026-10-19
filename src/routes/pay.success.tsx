import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/Confetti";
import { GiftCard } from "@/components/GiftCard";
import { listMyCards } from "@/lib/orders.functions";
import { brandArt } from "@/lib/catalog";

export const Route = createFileRoute("/pay/success")({
  ssr: false,
  validateSearch: z.object({ order: z.string().catch("") }),
  head: () => ({
    meta: [
      { title: "Payment successful — Giftloom" },
      { name: "description", content: "Your order is complete." },
      { property: "og:title", content: "Success — Giftloom" },
      { property: "og:description", content: "Order complete." },
    ],
  }),
  component: Success,
});

function Success() {
  const { order } = Route.useSearch();
  const { data } = useQuery({ queryKey: ["my-cards"], enabled: !!order, queryFn: () => listMyCards() });
  const o = data?.find((c) => c.order_number === order);
  const paid = o?.status === "paid";

  return (
    <div className="mx-auto max-w-lg px-4 py-14 text-center">
      {paid && <Confetti />}
      <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
      <h1 className="mt-4 text-3xl font-extrabold">{paid ? "Your gift card is ready" : "Confirming your payment…"}</h1>
      <p className="mt-2 text-muted-foreground">Order number <span className="font-mono font-semibold text-foreground">{order}</span></p>

      {o && paid && o.code && (
        <div className="mt-8 text-left">
          <GiftCard brand={brandArt(o.brand, o.hue)} amount={o.amount} code={o.code} interactive />
          <div className="mt-4 rounded-xl border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your gift card code</p>
            <p className="mt-1 font-mono text-xl font-bold">{o.code}</p>
          </div>
        </div>
      )}
      {o && !paid && <p className="mt-6 text-muted-foreground">Status: {o.status}. If this does not change shortly, contact support with your order number.</p>}

      <div className="mt-8 flex justify-center gap-3">
        <Button asChild><Link to="/my-cards">Go to My cards</Link></Button>
        <Button asChild variant="outline"><Link to="/catalog">Keep browsing</Link></Button>
      </div>
    </div>
  );
}
