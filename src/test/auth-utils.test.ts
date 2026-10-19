import { describe, expect, it } from "vitest";
import { authErrorFromUrl, friendlyAuthError, validatePassword } from "../lib/auth-utils";

describe("friendlyAuthError", () => {
  it("explains an unconfirmed email", () => {
    expect(friendlyAuthError("Email not confirmed").includes("confirm your email")).toBe(true);
  });
  it("does not reveal which half of a login was wrong", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("That email and password don't match. Double-check and try again.");
  });
  it("handles an existing account, reuse of the old password and rate limits", () => {
    expect(friendlyAuthError("User already registered").includes("signing in")).toBe(true);
    expect(friendlyAuthError("New password should be different from the old password.").includes("different")).toBe(true);
    expect(friendlyAuthError("For security purposes, you can only request this after 45 seconds").includes("Too many")).toBe(true);
  });
  it("handles expired links and weak passwords", () => {
    expect(friendlyAuthError("Email link is invalid or has expired").includes("expired")).toBe(true);
    expect(friendlyAuthError("Password should be at least 6 characters").includes("stronger")).toBe(true);
  });
  it("falls back to a generic message", () => {
    expect(friendlyAuthError("boom")).toBe("Something went wrong. Please try again.");
  });
});

describe("validatePassword", () => {
  it("requires 8 to 72 characters", () => {
    expect(validatePassword("short")).toBe("Use at least 8 characters.");
    expect(validatePassword("long-enough")).toBeNull();
    expect(validatePassword("x".repeat(73))).toBe("Use at most 72 characters.");
  });
});

describe("authErrorFromUrl", () => {
  it("reads an expired-link error from the hash", () => {
    expect(authErrorFromUrl("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "")).toBe("Email link is invalid or has expired");
  });
  it("reads an error from the query string", () => {
    expect(authErrorFromUrl("", "?error=access_denied")).toBe("access_denied");
  });
  it("returns null for a clean URL or a normal token hash", () => {
    expect(authErrorFromUrl("", "")).toBeNull();
    expect(authErrorFromUrl("#access_token=abc&type=signup", "")).toBeNull();
  });
});
