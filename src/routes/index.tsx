import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, MousePointerClick, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GiftCard, CardFace } from "@/components/GiftCard";
import { brandArt } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Giftloom — digital gift cards" },
      { name: "description", content: "Buy digital gift cards online. Pay securely and get your code right after payment is verified." },
      { property: "og:title", content: "Giftloom — digital gift cards" },
      { property: "og:description", content: "Buy digital gift cards online and get your code right after payment." },
    ],
  }),
  component: Home,
});

const STEPS = [
  { icon: MousePointerClick, title: "Choose a card", text: "Pick a brand and an amount from the catalog." },
  { icon: Wallet, title: "Pay securely", text: "Pay through our payment gateway. We never see or store your card or UPI details." },
  { icon: Sparkles, title: "Get your code", text: "Your code appears as soon as the payment is verified, and stays in My cards." },
];

function Home() {
  const { data } = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog() });
  const brands = data?.brands ?? [];
  const first = brands[0];
  const heroBrand = first ?? brandArt("Giftloom");
  const heroAmount = first?.denominations[0]?.amount ?? 500;

  return (
    <>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-2 md:pt-20">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Digital gift cards, <span className="text-primary">delivered</span> <span className="text-highlight">right after payment</span>.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Choose a brand, pay securely, and your code appears in your account as soon as the payment is verified.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/catalog">Browse the catalog <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/support">Need help?</Link></Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <div className="animate-float">
              <GiftCard brand={heroBrand} amount={heroAmount} interactive />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">Move your pointer over it, tap to flip.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-extrabold">Brands</h2>
          <Link to="/catalog" className="text-sm font-semibold text-primary hover:underline">See all →</Link>
        </div>
        {brands.length === 0 ? (
          <p className="text-muted-foreground">Our catalog is being stocked. Please check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {brands.map((b, i) => (
              <motion.div key={b.slug} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }} whileHover={{ y: -6 }}>
                <Link to="/catalog" search={{ category: b.category }} className="block">
                  <CardFace brand={b} className="shadow-card" />
                  {b.tagline && <p className="mt-2 text-sm text-muted-foreground">{b.tagline}</p>}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-8 text-3xl font-extrabold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="rounded-2xl border bg-card p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground"><s.icon className="h-5 w-5" /></div>
              <p className="text-xs font-bold uppercase tracking-widest text-highlight">Step {i + 1}</p>
              <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}
