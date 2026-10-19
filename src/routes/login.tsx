import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resendConfirmation, sendPasswordReset, signIn, signUp, useAuth } from "@/lib/auth";
import { validatePassword } from "@/lib/auth-utils";
import { safeRedirect } from "@/lib/catalog";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — Giftloom" },
      { name: "description", content: "Sign in or create an account on Giftloom." },
      { property: "og:title", content: "Sign in — Giftloom" },
      { property: "og:description", content: "Create an account to buy gift cards." },
    ],
  }),
  component: Login,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

type Panel =
  | { kind: "form" }
  | { kind: "confirm"; email: string }
  | { kind: "forgot" }
  | { kind: "reset-sent"; email: string };

function AuthForm({ mode, onDone, onConfirm, onForgot }: { mode: "in" | "up"; onDone: () => void; onConfirm: (email: string) => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const em = emailSchema.safeParse(email);
    if (!em.success) return setError(em.error.issues[0]?.message ?? "Check your email");
    const pwError = mode === "up" ? validatePassword(password) : password ? null : "Enter your password";
    if (pwError) return setError(pwError);
    setBusy(true);
    if (mode === "in") {
      const r = await signIn(em.data, password);
      setBusy(false);
      if (r.unconfirmed) return onConfirm(em.data);
      if (r.error) return setError(r.error);
      onDone();
    } else {
      const r = await signUp(em.data, password);
      setBusy(false);
      if (r.error) return setError(r.error);
      if (r.needsConfirmation) return onConfirm(em.data);
      onDone();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`email-${mode}`}>Email</Label>
        <Input id={`email-${mode}`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`pw-${mode}`}>Password</Label>
        <Input id={`pw-${mode}`} type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === "up" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</Button>
      {mode === "in" && (
        <button type="button" onClick={onForgot} className="w-full text-center text-sm font-medium text-primary hover:underline">Forgot your password?</button>
      )}
    </form>
  );
}

function ConfirmPanel({ email, onBack }: { email: string; onBack: () => void }) {
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    setBusy(true);
    setMsg(null);
    const err = await resendConfirmation(email);
    setBusy(false);
    if (err) return setMsg(err);
    setMsg("Sent again. Check your inbox and your spam folder.");
    setWait(60);
  };

  return (
    <div className="space-y-4 text-center">
      <MailCheck className="mx-auto h-12 w-12 text-primary" aria-hidden />
      <h2 className="text-2xl font-extrabold">Check your inbox</h2>
      <p className="text-muted-foreground">
        We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Click it to verify your email, then come back and sign in.
      </p>
      <p className="text-sm text-muted-foreground">Already have an account with this email? Sign in or reset your password instead. No email after a few minutes? Check spam, or resend it.</p>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <Button variant="outline" className="w-full" onClick={resend} disabled={busy || wait > 0}>
        {wait > 0 ? `Resend available in ${wait}s` : busy ? "Sending…" : "Resend confirmation email"}
      </Button>
      <Button variant="ghost" className="w-full" onClick={onBack}>Back to sign in</Button>
    </div>
  );
}

function ForgotPanel({ onBack, onSent }: { onBack: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const em = emailSchema.safeParse(email);
    if (!em.success) return setError(em.error.issues[0]?.message ?? "Check your email");
    setBusy(true);
    const err = await sendPasswordReset(em.data);
    setBusy(false);
    if (err) return setError(err);
    onSent(em.data);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-2xl font-extrabold">Reset your password</h2>
      <p className="text-muted-foreground">Enter your email and we will send you a link to choose a new password.</p>
      <div className="space-y-2">
        <Label htmlFor="email-forgot">Email</Label>
        <Input id="email-forgot" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>Back to sign in</Button>
    </form>
  );
}

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [panel, setPanel] = useState<Panel>({ kind: "form" });
  const target = safeRedirect(redirect);
  const done = () => navigate({ href: target, replace: true });

  // Already signed in (for example right after confirming an email): go straight on.
  useEffect(() => {
    if (ready && user) navigate({ href: target, replace: true });
  }, [ready, user, target, navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      {panel.kind === "form" && (
        <>
          <h1 className="mb-2 text-3xl font-extrabold">Welcome to Giftloom</h1>
          <p className="mb-6 text-muted-foreground">Create an account or sign in to buy and manage your gift cards.</p>
        </>
      )}
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        {panel.kind === "form" && (
          <Tabs defaultValue="in">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="in">Sign in</TabsTrigger>
              <TabsTrigger value="up">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="in">
              <AuthForm mode="in" onDone={done} onConfirm={(email) => setPanel({ kind: "confirm", email })} onForgot={() => setPanel({ kind: "forgot" })} />
            </TabsContent>
            <TabsContent value="up">
              <AuthForm mode="up" onDone={done} onConfirm={(email) => setPanel({ kind: "confirm", email })} onForgot={() => setPanel({ kind: "forgot" })} />
            </TabsContent>
          </Tabs>
        )}
        {panel.kind === "confirm" && <ConfirmPanel email={panel.email} onBack={() => setPanel({ kind: "form" })} />}
        {panel.kind === "forgot" && <ForgotPanel onBack={() => setPanel({ kind: "form" })} onSent={(email) => setPanel({ kind: "reset-sent", email })} />}
        {panel.kind === "reset-sent" && (
          <div className="space-y-4 text-center">
            <MailCheck className="mx-auto h-12 w-12 text-primary" aria-hidden />
            <h2 className="text-2xl font-extrabold">Check your inbox</h2>
            <p className="text-muted-foreground">If an account exists for <span className="font-semibold text-foreground">{panel.email}</span>, we sent a link to reset your password. It may take a few minutes.</p>
            <Button variant="ghost" className="w-full" onClick={() => setPanel({ kind: "form" })}>Back to sign in</Button>
          </div>
        )}
      </div>
    </div>
  );
}
