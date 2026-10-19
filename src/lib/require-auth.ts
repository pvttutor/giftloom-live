import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Client-only guard: send signed-out visitors to /login and return them afterward. */
export async function requireUser(href: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw redirect({ to: "/login", search: { redirect: href } });
  return data.user;
}
