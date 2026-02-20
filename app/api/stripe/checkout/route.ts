import { NextResponse } from "next/server";
import { getUserEntitlement, upsertEntitlement } from "../../../lib/entitlements";
import { syncProfileAndEntitlementForUser } from "../../../lib/profileSync";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getStripeClient, getStripePriceIds } from "../../../lib/stripe";

type CheckoutBody = {
  plan?: "pro_monthly" | "pro_annual";
};

function getSiteUrl(request: Request) {
  const requestUrl = new URL(request.url);
  return process.env.NEXT_PUBLIC_SITE_URL ?? requestUrl.origin;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncProfileAndEntitlementForUser(user);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email_verified, is_vcom_eligible")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  }
  if (!profile?.email_verified) {
    return NextResponse.json({ error: "Email verification required" }, { status: 400 });
  }
  if (profile.is_vcom_eligible) {
    return NextResponse.json({ error: "VCOM users are already covered" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as CheckoutBody;
  const selectedPlan = body.plan;
  if (selectedPlan !== "pro_monthly" && selectedPlan !== "pro_annual") {
    return NextResponse.json({ error: "Invalid plan selection" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const { monthly, annual } = getStripePriceIds();
  const priceId = selectedPlan === "pro_monthly" ? monthly : annual;

  const entitlement = await getUserEntitlement(user.id);
  let customerId = entitlement?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  const siteUrl = getSiteUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${siteUrl}/?checkout=success`,
    cancel_url: `${siteUrl}/?checkout=cancel`,
    metadata: { user_id: user.id, selected_plan: selectedPlan },
    subscription_data: {
      metadata: { user_id: user.id, selected_plan: selectedPlan },
    },
    allow_promotion_codes: true,
  });

  await upsertEntitlement({
    user_id: user.id,
    plan_type: entitlement?.plan_type ?? "trial",
    status: entitlement?.status ?? "inactive",
    trial_starts_at: entitlement?.trial_starts_at ?? null,
    trial_ends_at: entitlement?.trial_ends_at ?? null,
    stripe_customer_id: customerId,
    stripe_subscription_id: entitlement?.stripe_subscription_id ?? null,
    current_period_end: entitlement?.current_period_end ?? null,
  });

  return NextResponse.json({ url: session.url });
}
