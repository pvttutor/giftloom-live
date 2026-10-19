import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { addInventory, adminOrders, adminOverview, saveBrand, saveDenomination, updateOrder } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/catalog";
import { requireUser } from "@/lib/require-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: ({ location }) => requireUser(location.href),
  head: () => ({
    meta: [
      { title: "Admin — Giftloom" },
      { name: "description", content: "Owner-only dashboard." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — Giftloom" },
      { property: "og:description", content: "Owner-only area." },
    ],
  }),
  component: Admin,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;
type BrandForm = { name: string; category: string; tagline: string; hue: number; active: boolean; sortOrder: number };
const EMPTY_BRAND: BrandForm = { name: "", category: "", tagline: "", hue: 262, active: true, sortOrder: 0 };
const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

function Row({ title, meta, body }: { title: string; meta: string; body?: string | null }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{title}</span><span className="text-xs text-muted-foreground">{meta}</span></div>
      {body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

function counts(o: Overview, brand: string, amount: number, test: boolean) {
  const r = o.stock.find((s) => s.brand === brand && s.denomination === amount && s.is_test === test);
  return { available: r?.available ?? 0, reserved: r?.reserved ?? 0, sold: r?.sold ?? 0 };
}

function Triple({ c, warn }: { c: { available: number; reserved: number; sold: number }; warn: boolean }) {
  return (
    <span className="whitespace-nowrap font-mono">
      <span className={cn(warn && c.available === 0 && "font-bold text-destructive")}>{c.available}</span> / {c.reserved} / {c.sold}
    </span>
  );
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  paid_unfulfilled: "destructive",
  pending: "secondary",
};

function Admin() {
  const { isAdmin, ready } = useAuth();
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const overview = useQuery({ queryKey: ["admin-overview"], enabled: isAdmin, queryFn: () => adminOverview() });
  const orders = useQuery({ queryKey: ["admin-orders"], enabled: isAdmin, queryFn: () => adminOrders() });
  const inbox = useQuery({
    queryKey: ["admin-inbox"],
    enabled: isAdmin,
    queryFn: async () => {
      const [t, f, m] = await Promise.all([
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("feedback").select("*").order("created_at", { ascending: false }),
        supabase.from("messages").select("*").order("created_at", { ascending: false }),
      ]);
      return { tickets: t.data ?? [], feedback: f.data ?? [], messages: m.data ?? [] };
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_BRAND);
  const [newAmount, setNewAmount] = useState<Record<string, string>>({});
  const [up, setUp] = useState({ brandId: "", amount: "", source: "", isTest: true, codes: "" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const brandM = useMutation({
    mutationFn: (v: BrandForm & { id?: string }) => saveBrand({ data: v }),
    onSuccess: () => { toast.success("Brand saved"); setEditing(null); setForm(EMPTY_BRAND); refresh(); },
    onError,
  });
  const denM = useMutation({
    mutationFn: (v: { id?: string; brandId: string; amount: number; active: boolean }) => saveDenomination({ data: v }),
    onSuccess: () => { toast.success("Denomination saved"); refresh(); },
    onError,
  });
  const uploadM = useMutation({
    mutationFn: (v: { brandId: string; denomination: number; isTest: boolean; source?: string; codes: string[] }) => addInventory({ data: v }),
    onSuccess: (r) => {
      toast.success(`Added ${r.added} codes, skipped ${r.skippedDuplicates} duplicates`);
      setUp((u) => ({ ...u, codes: "" }));
      refresh();
    },
    onError,
  });

  const orderM = useMutation({
    mutationFn: (v: { orderNumber: string; action: "fulfil" | "refunded" | "close" | "note"; note?: string }) => updateOrder({ data: v }),
    onSuccess: () => { toast.success("Order updated"); refresh(); },
    onError,
  });

  if (!ready) return <p className="p-10 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-bold">Owner only</h1><p className="mt-2 text-muted-foreground">This page is visible only to the store owner.</p></div>;

  const o = overview.data;
  const allOrders = orders.data ?? [];
  const shownOrders = statusFilter === "all" ? allOrders : allOrders.filter((r) => r.status === statusFilter);
  const attention = allOrders.filter((r) => r.status === "paid_unfulfilled").length;
  const when = (s: string) => new Date(s).toLocaleString();
  const upBrandDens = o?.denominations.filter((d) => d.brand_id === up.brandId && d.active) ?? [];

  const submitBrand = (e: React.FormEvent) => {
    e.preventDefault();
    brandM.mutate({ ...(editing ? { id: editing } : {}), ...form });
  };
  const submitUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const codes = up.codes.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!up.brandId || !up.amount) return toast.error("Choose a brand and a denomination.");
    if (codes.length === 0) return toast.error("Paste at least one code.");
    if (codes.length > 1000) return toast.error("Upload at most 1000 codes at a time.");
    if (codes.some((c) => c.length < 4 || c.length > 128)) return toast.error("Each code must be 4 to 128 characters.");
    if (!up.isTest && !window.confirm(`Load ${codes.length} REAL codes? They will be sold to customers once live payment keys are on.`)) return;
    uploadM.mutate({ brandId: up.brandId, denomination: Number(up.amount), isTest: up.isTest, codes, ...(up.source.trim() ? { source: up.source.trim() } : {}) });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Admin" subtitle="Orders, brands, denominations, voucher stock and customer messages." />
      <Tabs defaultValue="orders">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="orders">Orders{attention > 0 ? ` (${attention} need attention)` : ""}</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="upload">Upload codes</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({inbox.data?.tickets.length ?? 0})</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({inbox.data?.feedback.length ?? 0})</TabsTrigger>
          <TabsTrigger value="messages">Messages ({inbox.data?.messages.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="Filter by status" className={cn(selectCls, "w-auto")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All orders</option>
              <option value="paid_unfulfilled">Needs attention (paid, not delivered)</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
            <span className="text-sm text-muted-foreground">Latest 300 orders. Orders become paid only through a verified payment.</span>
          </div>
          {orders.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!orders.isLoading && shownOrders.length === 0 && <p className="text-muted-foreground">No orders to show.</p>}
          {shownOrders.map((r) => (
            <div key={r.id} className={cn("space-y-3 rounded-xl border bg-card p-4", r.status === "paid_unfulfilled" && "border-destructive")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{r.order_number}</span>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
                  {r.test_mode && <Badge variant="outline">test order</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{when(r.created_at)}</span>
              </div>
              <p className="text-sm">{r.email ?? "unknown customer"} · {r.brand} · <strong>{formatINR(r.amount)}</strong></p>
              <p className="break-all font-mono text-xs text-muted-foreground">gateway order {r.provider_order_id ?? "-"} · payment {r.provider_payment_id ?? "-"}</p>
              {r.status === "paid_unfulfilled" && <p className="text-sm text-destructive">The customer paid but the reserved voucher was lost. Fulfil from stock, or refund in the Razorpay dashboard and mark it refunded.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label={`Note for ${r.order_number}`} className="h-8 min-w-[12rem] flex-1" maxLength={500} placeholder="Admin note" value={notes[r.order_number] ?? r.admin_note ?? ""} onChange={(e) => setNotes((s) => ({ ...s, [r.order_number]: e.target.value }))} />
                <Button size="sm" variant="outline" disabled={orderM.isPending} onClick={() => orderM.mutate({ orderNumber: r.order_number, action: "note", note: notes[r.order_number] ?? r.admin_note ?? "" })}>Save note</Button>
              </div>
              {r.status === "paid_unfulfilled" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={orderM.isPending} onClick={() => orderM.mutate({ orderNumber: r.order_number, action: "fulfil" })}>Fulfil from stock</Button>
                  <Button size="sm" variant="outline" disabled={orderM.isPending} onClick={() => { if (window.confirm("Only mark refunded AFTER you have refunded the customer in the Razorpay dashboard. Continue?")) orderM.mutate({ orderNumber: r.order_number, action: "refunded" }); }}>Mark refunded</Button>
                </div>
              )}
              {(r.status === "pending" || r.status === "expired") && (
                <Button size="sm" variant="outline" disabled={orderM.isPending} onClick={() => { if (window.confirm("Close this unpaid order and release its voucher? If the customer pays afterwards it will be flagged for refund.")) orderM.mutate({ orderNumber: r.order_number, action: "close" }); }}>Close unpaid order</Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="stock">
          <p className="mb-3 text-sm text-muted-foreground">Each cell shows available / reserved / sold. Customers see only in stock or out of stock. Real stock is sold under live keys, test stock under test keys.</p>
          {o && o.brands.length === 0 && <p className="text-muted-foreground">No brands yet. Create one in the Brands tab.</p>}
          {o && o.brands.length > 0 && (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Brand</th><th className="p-3">Amount</th><th className="p-3">Real stock</th><th className="p-3">Test stock</th></tr></thead>
                <tbody>
                  {o.brands.flatMap((b) => {
                    const dens = o.denominations.filter((d) => d.brand_id === b.id);
                    return dens.map((d) => (
                      <tr key={d.id} className={cn("border-b last:border-0", (!b.active || !d.active) && "opacity-50")}>
                        <td className="p-3 font-medium">{b.name}{!b.active && " (hidden)"}</td>
                        <td className="p-3">{formatINR(d.amount)}{!d.active && " (hidden)"}</td>
                        <td className="p-3"><Triple c={counts(o, b.name, d.amount, false)} warn={b.active && d.active} /></td>
                        <td className="p-3"><Triple c={counts(o, b.name, d.amount, true)} warn={false} /></td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="brands" className="space-y-6">
          <form onSubmit={submitBrand} className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
            <h2 className="text-lg font-bold sm:col-span-2">{editing ? "Edit brand" : "Add a brand"}</h2>
            <div className="space-y-2"><Label htmlFor="bn">Name</Label><Input id="bn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="bc">Category</Label><Input id="bc" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="bt">Tagline (optional)</Label><Input id="bt" maxLength={140} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
            <div className="space-y-2">
              <Label htmlFor="bh">Card color (0 to 360)</Label>
              <div className="flex items-center gap-3">
                <Input id="bh" type="number" min={0} max={360} value={form.hue} onChange={(e) => setForm({ ...form, hue: Number(e.target.value) })} />
                <span aria-hidden className="h-9 w-9 shrink-0 rounded-md border" style={{ background: `oklch(0.5 0.2 ${form.hue})` }} />
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="bs">Sort order</Label><Input id="bs" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible in the store</label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={brandM.isPending}>{editing ? "Save changes" : "Add brand"}</Button>
              {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(EMPTY_BRAND); }}>Cancel</Button>}
            </div>
          </form>

          {o?.brands.map((b) => {
            const dens = o.denominations.filter((d) => d.brand_id === b.id);
            return (
              <div key={b.id} className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="h-6 w-6 rounded-md" style={{ background: `oklch(0.5 0.2 ${b.hue})` }} />
                    <span className="font-bold">{b.name}</span><span className="text-sm text-muted-foreground">{b.category}{!b.active && " · hidden"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(b.id); setForm({ name: b.name, category: b.category, tagline: b.tagline, hue: b.hue, active: b.active, sortOrder: b.sort_order }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {dens.map((d) => (
                    <button key={d.id} type="button" title={d.active ? "Click to hide" : "Click to show"}
                      onClick={() => denM.mutate({ id: d.id, brandId: b.id, amount: d.amount, active: !d.active })}
                      className={cn("rounded-full border px-3 py-1 text-sm", d.active ? "bg-secondary" : "line-through opacity-50")}>
                      {formatINR(d.amount)}
                    </button>
                  ))}
                  <form className="flex items-center gap-2" onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(newAmount[b.id]);
                    if (!Number.isInteger(n) || n <= 0) return toast.error("Enter a whole amount in rupees.");
                    denM.mutate({ brandId: b.id, amount: n, active: true }, { onSuccess: () => setNewAmount((s) => ({ ...s, [b.id]: "" })) });
                  }}>
                    <Input aria-label={`New amount for ${b.name}`} className="h-8 w-28" inputMode="numeric" placeholder="Amount ₹" value={newAmount[b.id] ?? ""} onChange={(e) => setNewAmount((s) => ({ ...s, [b.id]: e.target.value }))} />
                    <Button size="sm" type="submit" disabled={denM.isPending}>Add</Button>
                  </form>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="upload">
          <form onSubmit={submitUpload} className="space-y-4 rounded-2xl border bg-card p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ub">Brand</Label>
                <select id="ub" className={selectCls} value={up.brandId} onChange={(e) => setUp({ ...up, brandId: e.target.value, amount: "" })}>
                  <option value="">Choose a brand</option>
                  {o?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ua">Denomination</Label>
                <select id="ua" className={selectCls} value={up.amount} onChange={(e) => setUp({ ...up, amount: e.target.value })} disabled={!up.brandId}>
                  <option value="">Choose an amount</option>
                  {upBrandDens.map((d) => <option key={d.id} value={d.amount}>{formatINR(d.amount)}</option>)}
                </select>
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">What are these codes?</legend>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="kind" className="mt-1" checked={up.isTest} onChange={() => setUp({ ...up, isTest: true })} /> <span><strong>Test codes</strong>: made-up codes for sandbox testing. Sold only under test keys.</span></label>
              <label className="flex items-start gap-2 text-sm"><input type="radio" name="kind" className="mt-1" checked={!up.isTest} onChange={() => setUp({ ...up, isTest: false })} /> <span><strong>Real codes</strong>: genuine vouchers from your supplier. Sold only under live keys.</span></label>
            </fieldset>
            <div className="space-y-2"><Label htmlFor="us">Source (supplier, invoice or batch reference)</Label><Input id="us" maxLength={200} value={up.source} onChange={(e) => setUp({ ...up, source: e.target.value })} /></div>
            <div className="space-y-2">
              <Label htmlFor="uc">Codes, one per line</Label>
              <Textarea id="uc" rows={8} className="font-mono" autoComplete="off" spellCheck={false} value={up.codes} onChange={(e) => setUp({ ...up, codes: e.target.value })} />
              <p className="text-xs text-muted-foreground">Codes are encrypted on the server and cleared from this box after upload. Duplicates are skipped.</p>
            </div>
            <Button type="submit" disabled={uploadM.isPending}>{uploadM.isPending ? "Uploading…" : "Upload codes"}</Button>
          </form>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-3">
          {inbox.data?.tickets.map((t) => <Row key={t.id} title={`${t.subject} — ${t.name}`} meta={`${t.email} · ${when(t.created_at)}`} body={t.message} />)}
        </TabsContent>
        <TabsContent value="feedback" className="space-y-3">
          {inbox.data?.feedback.map((f) => <Row key={f.id} title={`${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}`} meta={when(f.created_at)} body={f.comments} />)}
        </TabsContent>
        <TabsContent value="messages" className="space-y-3">
          {inbox.data?.messages.map((m) => <Row key={m.id} title={m.name} meta={`${m.email} · ${when(m.created_at)}`} body={m.message} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
