import type { User } from "@supabase/supabase-js";
import { FALLBACK_ALLOWED_DOMAINS } from "./billing/constants";
import { upsertEntitlement } from "./entitlements";
import { getSupabaseAdminClient } from "./supabase/admin";
import { isNoRowSupabaseError, logServerError } from "./supabase/errors";
import { getDomainFromEmailOrDomain, isVcomEligibleEmailOrDomain } from "./vcom";

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function extractDomain(email: string | null | undefined): string | null {
  return getDomainFromEmailOrDomain(email);
}

function isDomainAllowedByEntry(domain: string, allowedDomain: string): boolean {
  const normalizedAllowed = normalizeValue(allowedDomain);
  if (!normalizedAllowed) {
    return false;
  }
  return domain === normalizedAllowed || domain.endsWith(`.${normalizedAllowed}`);
}

async function isAllowedDomain(domain: string | null): Promise<boolean> {
  if (!domain) {
    return false;
  }

  // Always allow vcom.edu and any subdomain, even if allowed_domains is missing/incomplete.
  if (isVcomEligibleEmailOrDomain(domain)) {
    return true;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("allowed_domains").select("domain").eq("active", true);

  if (error) {
    // allowed_domains is optional; fall back to static allowlist if this query fails.
    logServerError("allowed_domains lookup failed", error);
    return FALLBACK_ALLOWED_DOMAINS.some((allowed) => isDomainAllowedByEntry(domain, allowed));
  }

  const matchesAllowedDomain = (data ?? []).some((row) => isDomainAllowedByEntry(domain, row.domain));
  if (matchesAllowedDomain) {
    return true;
  }

  return FALLBACK_ALLOWED_DOMAINS.some((allowed) => isDomainAllowedByEntry(domain, allowed));
}

export async function syncProfileAndEntitlementForUser(user: User) {
  const email = normalizeValue(user.email ?? "");
  const domain = extractDomain(email);
  const emailVerified = Boolean(user.email_confirmed_at);
  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : null;

  const supabase = getSupabaseAdminClient();

  const isVcomEligible = await isAllowedDomain(domain);
  if (process.env.NODE_ENV !== "production") {
    console.log("[entitlement-sync] domain-check", {
      email,
      domain,
      vcomEligible: isVcomEligible,
      emailVerified,
    });
  }

  const profilePayload = {
    id: user.id,
    full_name: fullName,
    email,
    email_verified: emailVerified,
    school_domain: domain,
    is_vcom_eligible: isVcomEligible,
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
  if (profileError) {
    throw profileError;
  }

  if (isVcomEligible) {
    const entitlement = await upsertEntitlement({
      user_id: user.id,
      plan_type: "vcom_free",
      status: "active",
      trial_starts_at: null,
      trial_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("[entitlement-sync] grant", {
        email,
        domain,
        planType: entitlement.plan_type,
        status: entitlement.status,
      });
    }
    return;
  }

  const { data: existingEntitlement, error: entitlementError } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (entitlementError) {
    if (!isNoRowSupabaseError(entitlementError)) {
      throw entitlementError;
    }
  }

  if (!existingEntitlement || isNoRowSupabaseError(entitlementError)) {
    const entitlement = await upsertEntitlement({
      user_id: user.id,
      plan_type: "trial",
      status: "inactive",
      trial_starts_at: null,
      trial_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("[entitlement-sync] grant", {
        email,
        domain,
        planType: entitlement.plan_type,
        status: entitlement.status,
      });
    }
  }
}
