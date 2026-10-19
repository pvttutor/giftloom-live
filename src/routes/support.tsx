import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Customer support — Giftloom" },
      { name: "description", content: "Answers to common questions and a support ticket form." },
      { property: "og:title", content: "Support — Giftloom" },
      { property: "og:description", content: "Questions about an order? Start here." },
    ],
  }),
  component: Support,
});

const FAQ: [string, string][] = [
  ["How do I get my gift card code?", "Pay for a card and the code appears on the confirmation page as soon as the payment is verified. It also stays in My cards."],
  ["I paid but I don't see my code.", "Open My cards and check the order status. If it is pending, wait a minute and refresh. If it does not change, send us a ticket with your order number."],
  ["Can I get a refund?", "Digital codes cannot be returned once they have been shown. If you paid and your code was not delivered, contact us with your order number and we will arrange a refund."],
  ["Is my payment information stored?", "No. Payments are handled by our payment gateway. We never see or store your card, UPI or bank details."],
  ["Where do I use my code?", "Redeem it with the brand, following the brand's own instructions. We cannot change or exchange a code once it has been issued."],
  ["What is the fastest way to reach you?", `Message us on Telegram at ${TELEGRAM_HANDLE}, or send a ticket below. Please include your order number.`],
];

const schema = z.object({
  name: z.string().trim().min(1, "Add your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().min(1, "Add a subject").max(150),
  message: z.string().trim().min(1, "Write a message").max(2000),
});

function Support() {
  const [f, setF] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check the form"); return; }
    setBusy(true);
    const { error } = await supabase.from("tickets").insert(p.data);
    setBusy(false);
    if (error) { toast.error("Couldn't send your ticket. Try again."); return; }
    toast.success("Ticket sent. We will get back to you by email.");
    setF({ name: "", email: "", subject: "", message: "" });
  };
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-2">
      <div>
        <PageHeader title="Customer support" subtitle="Quick answers first, then a ticket form if you still need us." />
        <div className="mb-8 rounded-2xl border border-primary/40 bg-secondary p-5">
          <p className="font-semibold">Need help fast?</p>
          <p className="mt-1 text-sm text-muted-foreground">Message us on Telegram ({TELEGRAM_HANDLE}) with your order number.</p>
          <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer"><Send /> Ask for Help on Telegram</a>
          </Button>
        </div>
        <Accordion type="single" collapsible>
          {FAQ.map(([q, a]) => q && (
            <AccordionItem key={q} value={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>
          ))}
        </Accordion>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-xl font-bold">Open a ticket</h2>
        {(["name", "email", "subject"] as const).map((k) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={k} className="capitalize">{k}</Label>
            <Input id={k} type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Send ticket"}</Button>
      </form>
    </div>
  );
}
