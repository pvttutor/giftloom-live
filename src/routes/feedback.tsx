import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — Giftloom" },
      { name: "description", content: "Rate your Giftloom experience from 1 to 5 and leave comments." },
      { property: "og:title", content: "Feedback — Giftloom" },
      { property: "og:description", content: "Tell us how we are doing." },
    ],
  }),
  component: Feedback,
});

function Feedback() {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) { toast.error("Pick a rating from 1 to 5."); return; }
    if (comments.length > 2000) { toast.error("Keep comments under 2000 characters."); return; }
    setBusy(true);
    const { error } = await supabase.from("feedback").insert({ rating, comments: comments.trim() || null });
    setBusy(false);
    if (error) { toast.error("Couldn't send feedback."); return; }
    toast.success("Thanks for the feedback!");
    setRating(0); setComments("");
  };
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHeader title="Feedback" subtitle="How was your experience?" />
      <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-card">
        <div role="radiogroup" aria-label="Rating" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
              whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.1 }} onClick={() => setRating(n)}>
              <Star className={cn("h-9 w-9 transition-colors", n <= rating ? "fill-highlight text-highlight" : "text-muted-foreground")} />
            </motion.button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="comments">Comments</Label>
          <Textarea id="comments" rows={5} value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Send feedback"}</Button>
      </form>
    </div>
  );
}
