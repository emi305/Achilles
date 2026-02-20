import type { EntitlementStatus, PlanType, UserEntitlement } from "./billing/types";
import { getSupabaseAdminClient } from "./supabase/admin";
import { isNoRowSupabaseError } from "./supabase/errors";

type SupabaseLikeError = {
  message?: string;
};

const MINIMAL_ENTITLEMENT_COLUMNS = ["user_id", "plan_type", "status", "stripe_customer_id", "stripe_subscription_id"] as const;

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function isMissingColumnError(error: unknown): boolean {
  const message = ((error as SupabaseLikeError | null)?.message ?? "").toLowerCase();
  return message.includes("column") && (message.includes("schema cache") || message.includes("does not exist"));
}

function toUserEntitlement(data: Partial<UserEntitlement>): UserEntitlement {
  return {
    user_id: data.user_id ?? "",
    plan_type: (data.plan_type as PlanType | undefined) ?? "trial",
    status: (data.status as EntitlementStatus | undefined) ?? "inactive",
    trial_starts_at: data.trial_starts_at ?? null,
    trial_ends_at: data.trial_ends_at ?? null,
    stripe_customer_id: data.stripe_customer_id ?? null,
    stripe_subscription_id: data.stripe_subscription_id ?? null,
    current_period_end: data.current_period_end ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
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
    if (isNoRowSupabaseError(error)) {
      return null;
    }
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
  if (!error) {
    return toUserEntitlement((data as Partial<UserEntitlement>) ?? {});
  }

  if (!isMissingColumnError(error)) {
    throw error;
  }

  // Fallback for older schemas missing optional entitlement columns.
  const minimalRow = Object.fromEntries(
    MINIMAL_ENTITLEMENT_COLUMNS.map((key) => [key, row[key as keyof typeof row] ?? null]),
  ) as Record<string, string | null>;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("entitlements")
    .upsert(minimalRow, { onConflict: "user_id" })
    .select("*")
    .single();

  if (fallbackError) {
    throw fallbackError;
  }

  return toUserEntitlement((fallbackData as Partial<UserEntitlement>) ?? {});
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

  if (
    (entitlement.plan_type === "pro_monthly" ||
      entitlement.plan_type === "pro_3month" ||
      entitlement.plan_type === "pro_annual") &&
    entitlement.status === "active"
  ) {
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

export function planFromPriceId(
  priceId: string,
  monthlyPriceId: string,
  threeMonthPriceId: string,
  annualPriceId: string,
): PlanType | null {
  if (priceId === monthlyPriceId) {
    return "pro_monthly";
  }
  if (priceId === threeMonthPriceId) {
    return "pro_3month";
  }
  if (priceId === annualPriceId) {
    return "pro_annual";
  }
  return null;
}
