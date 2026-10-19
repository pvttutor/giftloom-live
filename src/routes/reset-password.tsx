import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, useAuth } from "@/lib/auth";
import { validatePassword } from "@/lib/auth-utils";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Giftloom" },
      { name: "description", content: "Set a new password for your Giftloom account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "New password — Giftloom" },
      { property: "og:description", content: "Set a new password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The emailed link carries a recovery session that the Supabase client picks up on load. Give it a moment.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!ready || (!user && !waited)) return <p className="p-10 text-center text-muted-foreground">Checking your link…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">This link is invalid or has expired</h1>
        <p className="mt-2 text-muted-foreground">Reset links work once and expire quickly. Request a new one from the sign-in page.</p>
        <Button asChild className="mt-6"><Link to="/login">Back to sign in</Link></Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwError = validatePassword(pw);
    if (pwError) return setError(pwError);
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const err = await updatePassword(pw);
    setBusy(false);
    if (err) return setError(err);
    toast.success("Password updated.");
    navigate({ to: "/my-cards", replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="mb-2 text-3xl font-extrabold">Choose a new password</h1>
      <p className="mb-6 text-muted-foreground">Signed in as {user.email}.</p>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="np">New password</Label>
          <Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="np2">Repeat new password</Label>
          <Input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
      </form>
    </div>
  );
}
