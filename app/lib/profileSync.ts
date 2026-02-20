import type { User } from "@supabase/supabase-js";
import { FALLBACK_ALLOWED_DOMAINS } from "./billing/constants";
import { upsertEntitlement } from "./entitlements";
import { getSupabaseAdminClient } from "./supabase/admin";

function extractDomain(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= -1 || atIndex === email.length - 1) {
    return null;
  }
  return email.slice(atIndex + 1).toLowerCase();
}

async function isAllowedDomain(domain: string | null): Promise<boolean> {
  if (!domain) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("allowed_domains")
    .select("domain, active")
    .eq("domain", domain)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return true;
  }

  return FALLBACK_ALLOWED_DOMAINS.includes(domain);
}

export async function syncProfileAndEntitlementForUser(user: User) {
  const email = user.email ?? "";
  const domain = extractDomain(email);
  const emailVerified = Boolean(user.email_confirmed_at);
  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : null;

  const supabase = getSupabaseAdminClient();

  const isVcomEligible = emailVerified && (await isAllowedDomain(domain));
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
    await upsertEntitlement({
      user_id: user.id,
      plan_type: "vcom_free",
      status: "active",
      trial_starts_at: null,
      trial_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
    });
    return;
  }

  const { data: existingEntitlement, error: entitlementError } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (entitlementError) {
    throw entitlementError;
  }

  if (!existingEntitlement) {
    await upsertEntitlement({
      user_id: user.id,
      plan_type: "trial",
      status: "inactive",
      trial_starts_at: null,
      trial_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
    });
  }
}
