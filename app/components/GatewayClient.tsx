"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type GatewayClientProps = {
  viewer: {
    isAuthenticated: boolean;
    email: string | null;
  };
};

type Mode = "login" | "signup";

export function GatewayClient({ viewer }: GatewayClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(viewer.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const onForgotPassword = async () => {
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Enter your email above to reset your password.");
      return;
    }

    setResetBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        throw resetError;
      }
      setMessage("Password reset email sent.");
    } catch (resetSubmitError) {
      setError(resetSubmitError instanceof Error ? resetSubmitError.message : "Failed to send password reset email");
    } finally {
      setResetBusy(false);
    }
  };

  const onAuthSubmit = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    setConfirmPasswordError("");
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setConfirmPasswordError("Passwords do not match.");
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
            data: {
              username,
            },
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        setMessage("Account created. Check your email to verify before access is enabled.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw signInError;
        }
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-8">
      <div className="rounded-lg border border-stone-200 bg-white/95 p-6 shadow-sm">
        {!viewer.isAuthenticated ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md border px-4 py-2 text-sm font-semibold ${mode === "login" ? "border-stone-800 bg-stone-800 text-amber-50" : "border-stone-300 bg-white text-stone-700"}`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md border px-4 py-2 text-sm font-semibold ${mode === "signup" ? "border-stone-800 bg-stone-800 text-amber-50" : "border-stone-300 bg-white text-stone-700"}`}
              >
                Sign Up
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {mode === "signup" ? (
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  placeholder="Username"
                />
              ) : null}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
                placeholder="Email"
                type="email"
              />
              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (confirmPasswordError) {
                    setConfirmPasswordError("");
                  }
                }}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
                placeholder="Password"
                type="password"
              />
              {mode === "signup" ? (
                <input
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (confirmPasswordError) {
                      setConfirmPasswordError("");
                    }
                  }}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  placeholder="Confirm password"
                  type="password"
                />
              ) : null}
            </div>

            {mode === "login" ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={resetBusy || !email.trim()}
                  className="text-sm font-medium text-blue-600 transition hover:text-blue-500 disabled:cursor-not-allowed disabled:text-blue-300"
                >
                  {resetBusy ? "Sending..." : "Forgot password?"}
                </button>
                {!email.trim() ? (
                  <p className="text-xs text-stone-500">Enter your email above to reset your password.</p>
                ) : null}
              </div>
            ) : null}

            {mode === "signup" && confirmPasswordError ? (
              <p className="text-sm text-red-700">{confirmPasswordError}</p>
            ) : null}

            <button
              type="button"
              onClick={onAuthSubmit}
              disabled={busy || !email || !password || (mode === "signup" && !confirmPassword)}
              className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
            >
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-700">Signed in as <span className="font-semibold text-stone-900">{viewer.email}</span>.</p>
            <p className="text-sm text-stone-700">Redirecting you to continue...</p>
          </div>
        )}

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
