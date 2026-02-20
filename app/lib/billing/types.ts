export type PlanType = "vcom_free" | "trial" | "pro_monthly" | "pro_annual";

export type EntitlementStatus = "active" | "inactive" | "past_due" | "canceled" | "expired";

export type UserEntitlement = {
  user_id: string;
  plan_type: PlanType;
  status: EntitlementStatus;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  email_verified: boolean;
  school_domain: string | null;
  is_vcom_eligible: boolean;
  created_at: string;
  updated_at: string;
};
