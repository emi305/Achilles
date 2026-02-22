"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { Alert } from "./Alert";
import { Card } from "./Card";

export function ResetPasswordClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  useEffect(() => {
    let mounted = true;

    const bootstrapRecovery = async () => {
      setInitializing(true);
      setError("");
      setMessage("");

      try {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const urlErrorDescription = url.searchParams.get("error_description");

        if (urlErrorDescription) {
          if (mounted) {
            setError(urlErrorDescription);
            setReady(false);
          }
          return;
        }

        if (tokenHash && type === "recovery") {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (verifyError) {
            throw verifyError;
          }

          // Remove one-time token params after successful verification.
          window.history.replaceState({}, "", "/reset-password");
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (mounted) {
          setReady(Boolean(session));
          if (!session) {
            setError("This password reset link is invalid or expired. Request a new reset email and try again.");
          }
        }
      } catch (bootstrapError) {
        if (mounted) {
          setReady(false);
          setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to start password reset");
        }
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setError("");
      }
    });

    void bootstrapRecovery();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const onSubmit = async () => {
    setMessage("");
    setError("");
    setConfirmPasswordError("");

    if (!password) {
      setError("Enter a new password.");
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setMessage("Password updated. You can now log in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-8 w-full max-w-5xl">
      <Card
        title="Reset Password"
        description="Set a new password for your Achilles Insight account."
        className="mx-auto max-w-xl text-left"
      >
        <div className="space-y-4">
          <div className="grid gap-3">
            <input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (confirmPasswordError) {
                  setConfirmPasswordError("");
                }
              }}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
              placeholder="New password"
              type="password"
              autoComplete="new-password"
              disabled={initializing || !ready || busy}
            />
            <input
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (confirmPasswordError) {
                  setConfirmPasswordError("");
                }
              }}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
              placeholder="Confirm new password"
              type="password"
              autoComplete="new-password"
              disabled={initializing || !ready || busy}
            />
          </div>

          {initializing ? <Alert variant="info">Validating your password reset link...</Alert> : null}
          {!initializing && confirmPasswordError ? <Alert>{confirmPasswordError}</Alert> : null}
          {!initializing && error ? <Alert>{error}</Alert> : null}
          {!initializing && message ? <Alert variant="info">{message}</Alert> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={initializing || !ready || busy || !password || !confirmPassword}
              className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
            >
              {busy ? "Updating..." : "Update password"}
            </button>
            <Link href="/" className="text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900">
              Back to login
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
