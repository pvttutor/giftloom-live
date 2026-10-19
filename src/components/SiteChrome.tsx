import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Gift, Menu, Moon, Sun, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { signOut, useAuth } from "@/lib/auth";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "@/lib/site";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPaymentMode } from "@/lib/orders.functions";

/** Shown automatically whenever test payment keys are in use. Do not remove. */
export function TestModeBanner() {
  const { data } = useQuery({ queryKey: ["payment-mode"], queryFn: () => getPaymentMode() });
  if (!data?.configured || !data.testMode) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-highlight px-3 py-1.5 text-center text-xs font-semibold text-highlight-foreground">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Sandbox Test Mode — payments use test keys and no real money moves.
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("giftloom-theme");
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    localStorage.setItem("giftloom-theme", d ? "dark" : "light");
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

const NAV = [
  { to: "/catalog", label: "Catalog" },
  { to: "/my-cards", label: "My cards" },
  { to: "/support", label: "Support" },
  { to: "/feedback", label: "Feedback" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const links = (
    <>
      {NAV.map((n) => (
        <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}>
          {n.label}
        </Link>
      ))}
      {isAdmin && (
        <Link to="/admin" onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}>
          Admin
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Gift className="h-4 w-4" /></span>
          Giftloom
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex">{links}</nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          ) : (
            <Button asChild size="sm"><Link to="/login">Sign in</Link></Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-1 pt-12">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Link to="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">Home</Link>
              {links}
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">Telegram support</a>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Giftloom. All rights reserved.</p>
        <div className="flex flex-wrap gap-4">
          <Link to="/legal" className="hover:text-foreground">Terms & privacy</Link>
          <Link to="/support" className="hover:text-foreground">Support</Link>
          <Link to="/contact" className="hover:text-foreground">Contact us</Link>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">Telegram: {TELEGRAM_HANDLE}</a>
        </div>
      </div>
    </footer>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
