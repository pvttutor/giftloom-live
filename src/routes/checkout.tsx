import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, ShieldCheck, Clock } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GiftCard } from "@/components/GiftCard";
import { PageHeader } from "@/components/SiteChrome";
import { submitUpiOrder } from "@/lib/orders.functions";
import { flattenCatalog, formatINR } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog.functions";
import { requireUser } from "@/lib/require-auth";

const UPI_ID = "raghuwanshi.32@superyes";
const PAYEE_NAME = "PUSHKAR SINGH RAGHUWANSHI";

const REASONS: Record<string, string> = {
  out_of_stock: "Out of stock. Please choose another amount or check back soon.",
  too_many_pending: "You already have pending orders. Wait for verification or expiration before creating another.",
  unknown_item: "That gift card denomination is not available.",
  duplicate_utr: "This 12-digit UPI Transaction ID (UTR) has already been submitted.",
  invalid_utr: "Please enter a valid 12-digit numeric UPI Transaction ID (UTR).",
};

const DEFAULT_ERROR = "Could not submit your order. Please verify your 12-digit UTR or contact support on Telegram (@queenanshika).";

export const Route = createFileRoute("/checkout")({
  ssr: false,
  validateSearch: z.object({
    brand: z.string().catch(""),
    amount: z.coerce.number().catch(0),
  }),
  beforeLoad: ({ location }) => requireUser(location.href),
  head: () => ({
    meta: [
      { title: "Checkout — Giftloom" },
      { name: "description", content: "Scan the UPI QR code and submit your 12-digit UTR to receive your gift card." },
      { property: "og:title", content: "Checkout — Giftloom" },
      { property: "og:description", content: "Secure UPI checkout." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { brand: slug, amount } = Route.useSearch();
  const navigate = useNavigate();
  const [utr, setUtr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog() });
  const item = flattenCatalog(cat.data?.brands ?? []).find(
    (i) => i.brand.slug === slug && i.amount === amount
  );
  const brand = item?.brand;

  if (cat.isLoading) {
    return <p className="p-10 text-center text-muted-foreground">Loading…</p>;
  }

  if (!item || !brand) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Pick a card first</h1>
        <Button asChild className="mt-6">
          <Link to="/catalog">Open the catalog</Link>
        </Button>
      </div>
    );
  }

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard permission fails
    }
  };

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(
    PAYEE_NAME
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`${brand.name} Gift Card`)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedUtr = utr.trim();

    if (!/^\d{12}$/.test(cleanedUtr)) {
      setMsg("Please enter a valid 12-digit numeric UPI Transaction ID (UTR).");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const r = await submitUpiOrder({
        data: { brand: brand.slug, amount, utr: cleanedUtr },
      });

      if (!r.ok) {
        setMsg(REASONS[r.reason] ?? DEFAULT_ERROR);
        setBusy(false);
        return;
      }

      navigate({
        to: "/pay/success",
        search: { order: r.orderNumber },
        replace: true,
      });
    } catch {
      setMsg(DEFAULT_ERROR);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title="Checkout"
        subtitle="Scan the UPI QR code to pay, then submit your 12-digit UPI Transaction ID (UTR) for verification."
      />

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left Column: Selected Gift Card Summary */}
        <div className="space-y-4">
          <GiftCard brand={brand} amount={amount} interactive />
          <div className="flex justify-between rounded-xl border bg-card p-4">
            <span className="font-medium">{brand.name} Gift Card</span>
            <span className="text-lg font-bold">{formatINR(amount)}</span>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span>How Delivery Works</span>
            </div>
            <p>
              1. Scan the QR code or use the UPI ID to pay exactly <strong>{formatINR(amount)}</strong>.
            </p>
            <p>
              2. Enter the 12-digit UPI Transaction ID / UTR from your payment app (GPay, PhonePe, Paytm, super.money)[cite: 5].
            </p>
            <p>
              3. Once verified by our team, your gift card code appears in <strong>My Cards</strong>.
            </p>
          </div>
        </div>

        {/* Right Column: UPI QR Code & 12-Digit UTR Form */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold">Step 1: Scan & Pay {formatINR(amount)}</h2>
            <p className="text-sm text-muted-foreground">
              Scan using any UPI app (Google Pay, PhonePe, Paytm, super.money)[cite: 5]
            </p>
          </div>

          {/* QR Code Image */}
          <div className="flex flex-col items-center justify-center rounded-xl border bg-white p-4">
            <img
              src="/upi-qr.jpeg"
              alt="UPI QR Code for PUSHKAR SINGH RAGHUWANSHI"
              className="h-64 w-64 object-contain"
            />
            <p className="mt-2 text-xs font-semibold tracking-wide text-slate-800">
              {PAYEE_NAME}
            </p>
          </div>

          {/* Copy UPI ID & Mobile Intent Button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2 text-sm">
              <div className="truncate">
                <span className="text-xs text-muted-foreground block">UPI ID</span>
                <span className="font-mono font-medium">{UPI_ID}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyUpiId}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy UPI ID
                  </>
                )}
              </Button>
            </div>

            <Button asChild variant="secondary" className="w-full gap-2 sm:hidden">
              <a href={upiDeepLink}>
                <ExternalLink className="h-4 w-4" />
                Open UPI App to Pay {formatINR(amount)}
              </a>
            </Button>
          </div>

          {/* Step 2: 12-Digit UTR Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4 border-t pt-5">
            <div className="space-y-2">
              <Label htmlFor="utr-input" className="text-base font-semibold">
                Step 2: Enter 12-Digit UPI Transaction ID (UTR)
              </Label>
              <Input
                id="utr-input"
                type="text"
                inputMode="numeric"
                pattern="\d{12}"
                maxLength={12}
                placeholder="e.g. 429183746512"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                disabled={busy || !item.inStock}
                required
                className="font-mono text-base tracking-wider"
              />
              <p className="text-xs text-muted-foreground">
                Found in your UPI payment receipt as UTR / UPI Ref No ({utr.length}/12 digits).
              </p>
            </div>

            {!item.inStock && (
              <p role="alert" className="text-sm text-destructive">
                Out of stock. Please choose another amount or check back soon.
              </p>
            )}

            {msg && (
              <p role="alert" className="text-sm text-destructive font-medium">
                {msg}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={busy || !item.inStock || utr.length !== 12}
            >
              <ShieldCheck className="h-4 w-4" />
              {busy ? "Submitting Order…" : "Submit Transaction ID for Verification"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}