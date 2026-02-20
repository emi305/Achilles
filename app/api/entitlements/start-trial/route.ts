import { NextResponse } from "next/server";
import { TRIAL_LENGTH_DAYS } from "../../../lib/billing/constants";
import { getUserEntitlement, hasActiveAccessForEntitlement, upsertEntitlement } from "../../../lib/entitlements";
import { syncProfileAndEntitlementForUser } from "../../../lib/profileSync";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncProfileAndEntitlementForUser(user);
  const {
    data: profile,
    error: profileError,
  } = await supabase.from("profiles").select("is_vcom_eligible, email_verified").eq("id", user.id).maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  }

  if (!profile?.email_verified) {
    return NextResponse.json({ error: "Email must be verified before starting trial" }, { status: 400 });
  }

  if (profile.is_vcom_eligible) {
    return NextResponse.json({ error: "VCOM users already receive free access" }, { status: 400 });
  }

  const existing = await getUserEntitlement(user.id);
  if (existing) {
    if (existing.plan_type === "trial" && existing.trial_starts_at) {
      return NextResponse.json({ error: "Trial has already been used" }, { status: 400 });
    }
    if (hasActiveAccessForEntitlement(existing)) {
      return NextResponse.json({ error: "Access is already active" }, { status: 400 });
    }
  }

  const trialStart = new Date();
  const trialEnd = new Date(trialStart);
  trialEnd.setDate(trialStart.getDate() + TRIAL_LENGTH_DAYS);

  await upsertEntitlement({
    user_id: user.id,
    plan_type: "trial",
    status: "active",
    trial_starts_at: trialStart.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    stripe_customer_id: existing?.stripe_customer_id ?? null,
    stripe_subscription_id: existing?.stripe_subscription_id ?? null,
    current_period_end: existing?.current_period_end ?? null,
  });

  return NextResponse.json({ ok: true, trialEndsAt: trialEnd.toISOString() });
}
