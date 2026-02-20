"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserEntitlement } from "../lib/billing/types";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

type GatewayClientProps = {
  viewer: {
    isAuthenticated: boolean;
    hasActiveAccess: boolean;
    email: string | null;
    emailVerified: boolean;
    entitlement: UserEntitlement | null;
  };
};

type Mode = "login" | "signup";

async function postJson(url: string, body?: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; url?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}

export function GatewayClient({ viewer }: GatewayClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(viewer.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onAuthSubmit = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
            data: {
              full_name: fullName,
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

  const onStartTrial = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const payload = await postJson("/api/entitlements/start-trial");
      setMessage(payload.error ?? "Trial started.");
      router.refresh();
    } catch (trialError) {
      setError(trialError instanceof Error ? trialError.message : "Could not start trial");
    } finally {
      setBusy(false);
    }
  };

  const onCheckout = async (plan: "pro_monthly" | "pro_annual") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = await postJson("/api/stripe/checkout", { plan });
      if (!payload.url) {
        throw new Error("Missing checkout URL");
      }
      window.location.href = payload.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout");
      setBusy(false);
    }
  };

  const onManageBilling = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = await postJson("/api/stripe/portal");
      if (!payload.url) {
        throw new Error("Missing portal URL");
      }
      window.location.href = payload.url;
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Could not open billing portal");
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/auth/logout");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not log out");
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
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  placeholder="Full name (optional)"
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
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
                placeholder="Password"
                type="password"
              />
            </div>

            <button
              type="button"
              onClick={onAuthSubmit}
              disabled={busy || !email || !password}
              className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
            >
              {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-700">
              Signed in as <span className="font-semibold text-stone-900">{viewer.email}</span>
            </p>
            {!viewer.emailVerified ? (
              <p className="text-sm text-amber-700">Verify your email before entitlement access is activated.</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {viewer.hasActiveAccess ? (
                <Link
                  href="/app"
                  className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
                >
                  Enter App
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onStartTrial}
                  disabled={busy || !viewer.emailVerified}
                  className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
                >
                  Start 7-day free trial
                </button>
              )}
              {viewer.entitlement?.stripe_customer_id ? (
                <button
                  type="button"
                  onClick={onManageBilling}
                  disabled={busy}
                  className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                >
                  Manage Billing
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLogout}
                disabled={busy}
                className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60"
              >
                Log Out
              </button>
            </div>
          </div>
        )}

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-stone-200 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900">VCOM Students</h3>
          <p className="mt-2 text-3xl font-semibold text-stone-800">Free</p>
          <p className="mt-2 text-sm text-stone-600">Verified VCOM email domain gets automatic active entitlement.</p>
        </article>

        <article className="rounded-lg border border-stone-200 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900">Pro Monthly</h3>
          <p className="mt-2 text-3xl font-semibold text-stone-800">$29</p>
          <p className="text-sm text-stone-600">per month</p>
          <button
            type="button"
            onClick={() => onCheckout("pro_monthly")}
            disabled={busy || !viewer.isAuthenticated || !viewer.emailVerified}
            className="mt-4 inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
          >
            Choose Monthly
          </button>
        </article>

        <article className="rounded-lg border border-stone-200 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900">Pro Annual</h3>
          <p className="mt-2 text-3xl font-semibold text-stone-800">$199</p>
          <p className="text-sm text-stone-600">per year</p>
          <button
            type="button"
            onClick={() => onCheckout("pro_annual")}
            disabled={busy || !viewer.isAuthenticated || !viewer.emailVerified}
            className="mt-4 inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
          >
            Choose Annual
          </button>
        </article>
      </div>

      <p className="text-center text-sm text-stone-600">7-day free trial for non-VCOM users. Cancel anytime.</p>
    </div>
  );
}
