import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { authErrorFromUrl } from "@/lib/auth-utils";

export const Route = createFileRoute("/auth/confirmed")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Email confirmation — Giftloom" },
      { name: "description", content: "Confirm your email address for your Giftloom account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Email confirmation — Giftloom" },
      { property: "og:description", content: "Confirm your email address." },
    ],
  }),
  component: Confirmed,
});

function Confirmed() {
  const { user, ready } = useAuth();
  const [urlError, setUrlError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    setUrlError(authErrorFromUrl(window.location.hash, window.location.search));
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (urlError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <TriangleAlert className="mx-auto h-12 w-12 text-destructive" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">That link did not work</h1>
        <p className="mt-2 text-muted-foreground">It may have expired or already been used. Sign in and we will offer to send a fresh confirmation email.</p>
        <Button asChild className="mt-6"><Link to="/login">Go to sign in</Link></Button>
      </div>
    );
  }

  if (!ready || (!user && !waited)) return <p className="p-10 text-center text-muted-foreground">Confirming your email…</p>;

  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Email confirmed</h1>
        <p className="mt-2 text-muted-foreground">You are signed in as {user.email}.</p>
        <Button asChild className="mt-6"><Link to="/catalog">Browse the catalog</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Almost done</h1>
      <p className="mt-2 text-muted-foreground">Sign in to continue. If you just clicked a confirmation link and cannot sign in, try signing in and we will offer to resend it.</p>
      <Button asChild className="mt-6"><Link to="/login">Go to sign in</Link></Button>
    </div>
  );
}
