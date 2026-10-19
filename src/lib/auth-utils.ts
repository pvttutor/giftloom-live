// Pure helpers (no React, no network) so they can be unit tested.
export function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the confirmation link.";
  if (m.includes("invalid login")) return "That email and password don't match. Double-check and try again.";
  if (m.includes("already registered") || m.includes("already been registered")) return "That email already has an account. Try signing in instead.";
  if (m.includes("same password") || m.includes("different from the old")) return "Choose a password different from your current one.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("expired") || (m.includes("invalid") && m.includes("token"))) return "That link has expired. Please request a new one.";
  if (m.includes("weak") || m.includes("at least") || m.includes("password")) return "Use a stronger password (at least 8 characters).";
  return "Something went wrong. Please try again.";
}

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 72) return "Use at most 72 characters.";
  return null;
}

/** Reads an auth error that Supabase puts in the URL (hash or query) when a link is bad or expired. */
export function authErrorFromUrl(hash: string, search: string): string | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const q = new URLSearchParams(search);
  return p.get("error_description") ?? q.get("error_description") ?? p.get("error") ?? q.get("error");
}
