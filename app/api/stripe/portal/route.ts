import { NextResponse } from "next/server";
import { getUserEntitlement, upsertEntitlement } from "../../../lib/entitlements";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getStripeClient } from "../../../lib/stripe";

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

  const stripe = getStripeClient();
  const entitlement = await getUserEntitlement(user.id);
  let customerId = entitlement?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
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
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getSiteUrl(request)}/`,
  });

  return NextResponse.json({ url: portal.url });
}
