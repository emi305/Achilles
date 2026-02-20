import type { EntitlementStatus, PlanType, UserEntitlement } from "./billing/types";
import { getSupabaseAdminClient } from "./supabase/admin";

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export function mapStripeStatusToEntitlement(status: string): EntitlementStatus {
  if (status === "active" || status === "trialing") {
    return "active";
  }
  if (status === "past_due" || status === "unpaid") {
    return "past_due";
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return "canceled";
  }
  return "inactive";
}

export async function getUserEntitlement(userId: string): Promise<UserEntitlement | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("entitlements").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    throw error;
  }
  return (data as UserEntitlement | null) ?? null;
}

export async function upsertEntitlement(row: Partial<UserEntitlement> & { user_id: string }) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("entitlements")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return data as UserEntitlement;
}

export async function markTrialExpiredIfNeeded(entitlement: UserEntitlement): Promise<UserEntitlement> {
  if (entitlement.plan_type !== "trial" || entitlement.status !== "active") {
    return entitlement;
  }

  const trialEnd = toDate(entitlement.trial_ends_at);
  if (!trialEnd || trialEnd.getTime() > Date.now()) {
    return entitlement;
  }

  return upsertEntitlement({
    user_id: entitlement.user_id,
    plan_type: "trial",
    status: "expired",
    trial_starts_at: entitlement.trial_starts_at,
    trial_ends_at: entitlement.trial_ends_at,
    stripe_customer_id: entitlement.stripe_customer_id,
    stripe_subscription_id: entitlement.stripe_subscription_id,
    current_period_end: entitlement.current_period_end,
  });
}

export function hasActiveAccessForEntitlement(entitlement: UserEntitlement | null): boolean {
  if (!entitlement) {
    return false;
  }

  if (entitlement.plan_type === "vcom_free" && entitlement.status === "active") {
    return true;
  }

  if (entitlement.plan_type === "trial" && entitlement.status === "active") {
    const trialEnd = toDate(entitlement.trial_ends_at);
    return Boolean(trialEnd && trialEnd.getTime() > Date.now());
  }

  if ((entitlement.plan_type === "pro_monthly" || entitlement.plan_type === "pro_annual") && entitlement.status === "active") {
    return true;
  }

  return false;
}

export async function hasActiveAccess(userId: string): Promise<boolean> {
  const entitlement = await getUserEntitlement(userId);
  if (!entitlement) {
    return false;
  }
  const normalized = await markTrialExpiredIfNeeded(entitlement);
  return hasActiveAccessForEntitlement(normalized);
}

export function planFromPriceId(priceId: string, monthlyPriceId: string, annualPriceId: string): PlanType | null {
  if (priceId === monthlyPriceId) {
    return "pro_monthly";
  }
  if (priceId === annualPriceId) {
    return "pro_annual";
  }
  return null;
}
