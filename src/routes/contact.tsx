import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact us — Giftloom" },
      { name: "description", content: "Send a message to the Giftloom team." },
      { property: "og:title", content: "Contact us — Giftloom" },
      { property: "og:description", content: "Questions about an order or your account? Get in touch." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Add your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  message: z.string().trim().min(1, "Write a message").max(2000),
});

function Contact() {
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check the form"); return; }
    setBusy(true);
    const { error } = await supabase.from("messages").insert(p.data);
    setBusy(false);
    if (error) { toast.error("Couldn't send your message."); return; }
    toast.success("Message sent.");
    setF({ name: "", email: "", message: "" });
  };
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHeader title="Contact us" subtitle="Questions about an order or your account? Send us a message." />
      <div className="mb-6 rounded-2xl border border-primary/40 bg-secondary p-5">
        <p className="font-semibold">Prefer chat?</p>
        <p className="mt-1 text-sm text-muted-foreground">Reach us on Telegram: <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{TELEGRAM_HANDLE}</a></p>
        <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer"><Send /> Ask for Help on Telegram</a>
        </Button>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <div className="space-y-2"><Label htmlFor="cn">Name</Label><Input id="cn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="ce">Email</Label><Input id="ce" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="cm">Message</Label><Textarea id="cm" rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Send message"}</Button>
      </form>
    </div>
  );
}
