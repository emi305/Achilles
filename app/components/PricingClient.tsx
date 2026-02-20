"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserEntitlement } from "../lib/billing/types";

type PricingClientProps = {
  viewer: {
    email: string | null;
    emailVerified: boolean;
    entitlement: UserEntitlement | null;
  };
};

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

export function PricingClient({ viewer }: PricingClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onStartTrial = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/entitlements/start-trial");
      setMessage("Your 7-day trial is active.");
      router.push("/app");
      router.refresh();
    } catch (trialError) {
      setError(trialError instanceof Error ? trialError.message : "Could not start trial");
    } finally {
      setBusy(false);
    }
  };

  const onCheckout = async (plan: "pro_monthly" | "pro_3month" | "pro_annual") => {
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
      router.push("/");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not log out");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-5xl space-y-8">
      <div className="rounded-lg border border-stone-200 bg-white/95 p-6 shadow-sm">
        <p className="text-sm text-stone-700">
          Signed in as <span className="font-semibold text-stone-900">{viewer.email}</span>
        </p>
        {!viewer.emailVerified ? (
          <p className="mt-2 text-sm text-amber-700">Verify your email before starting a trial or subscription.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onStartTrial}
            disabled={busy || !viewer.emailVerified}
            className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
          >
            Start 7-day free trial
          </button>
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

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-stone-200 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900">Pro Monthly</h3>
          <p className="mt-2 text-3xl font-semibold text-stone-800">$19</p>
          <p className="text-sm text-stone-600">per month</p>
          <button
            type="button"
            onClick={() => onCheckout("pro_monthly")}
            disabled={busy || !viewer.emailVerified}
            className="mt-4 inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
          >
            Choose Monthly
          </button>
        </article>

        <article className="rounded-lg border border-stone-200 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900">Pro 3-Month</h3>
          <p className="mt-2 text-3xl font-semibold text-stone-800">$49</p>
          <p className="text-sm text-stone-600">every 3 months</p>
          <button
            type="button"
            onClick={() => onCheckout("pro_3month")}
            disabled={busy || !viewer.emailVerified}
            className="mt-4 inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
          >
            Choose 3-Month
          </button>
        </article>

        <article className="rounded-lg border border-stone-200 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900">Pro Annual</h3>
          <p className="mt-2 text-3xl font-semibold text-stone-800">$149</p>
          <p className="text-sm text-stone-600">per year</p>
          <button
            type="button"
            onClick={() => onCheckout("pro_annual")}
            disabled={busy || !viewer.emailVerified}
            className="mt-4 inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60"
          >
            Choose Annual
          </button>
        </article>
      </div>

      <p className="text-center text-sm text-stone-600">7-day free trial available. Cancel anytime.</p>

      {message ? <p className="text-center text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-center text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
