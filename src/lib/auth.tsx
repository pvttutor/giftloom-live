import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-utils";

export { friendlyAuthError };

type AuthState = { user: User | null; isAdmin: boolean; ready: boolean };
const AuthCtx = createContext<AuthState>({ user: null, isAdmin: false, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, ready: false });

  useEffect(() => {
    const load = async (user: User | null) => {
      let isAdmin = false;
      if (user) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        isAdmin = !!data?.some((r) => r.role === "admin");
      }
      setState({ user, isAdmin, ready: true });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => load(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// ---- Auth actions. Every one returns a friendly message instead of throwing. ----
// Supabase must list https://<your-domain>/** under Authentication, URL Configuration, Redirect URLs.
const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** needsConfirmation is true when Supabase requires the customer to verify their email first. */
export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin()}/auth/confirmed` },
  });
  if (error) return { error: friendlyAuthError(error.message), needsConfirmation: false };
  return { error: null, needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<{ error: string | null; unconfirmed: boolean }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { error: null, unconfirmed: false };
  return { error: friendlyAuthError(error.message), unconfirmed: error.message.toLowerCase().includes("email not confirmed") };
}

export async function resendConfirmation(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin()}/auth/confirmed` } });
  return error ? friendlyAuthError(error.message) : null;
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` });
  return error ? friendlyAuthError(error.message) : null;
}

export async function updatePassword(password: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? friendlyAuthError(error.message) : null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
