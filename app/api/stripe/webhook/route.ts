import { NextResponse } from "next/server";
import Stripe from "stripe";
import { mapStripeStatusToEntitlement, planFromPriceId, upsertEntitlement } from "../../../lib/entitlements";
import { getSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getStripeClient, getStripePriceIds } from "../../../lib/stripe";
import { requireEnv } from "../../../lib/supabase/env";

export const runtime = "nodejs";

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("entitlements").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  if (error) {
    throw error;
  }
  return data?.user_id ?? null;
}

function toIsoIfUnix(timestamp: number | null): string | null {
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const { monthly, annual } = getStripePriceIds();
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    return;
  }

  const plan = planFromPriceId(priceId, monthly, annual);
  if (!plan) {
    return;
  }

  const metadataUserId = subscription.metadata?.user_id;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = metadataUserId || (await resolveUserIdFromCustomer(customerId));
  if (!userId) {
    return;
  }

  await upsertEntitlement({
    user_id: userId,
    plan_type: plan,
    status: mapStripeStatusToEntitlement(subscription.status),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    current_period_end: toIsoIfUnix(subscription.current_period_end),
    trial_starts_at: null,
    trial_ends_at: null,
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const metadataUserId = session.metadata?.user_id ?? session.client_reference_id;
  if (!customerId || !metadataUserId) {
    return;
  }

  if (!subscriptionId) {
    await upsertEntitlement({
      user_id: metadataUserId,
      plan_type: "trial",
      status: "inactive",
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      current_period_end: null,
    });
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleSubscriptionUpsert(subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const metadataUserId = subscription.metadata?.user_id;
  const userId = metadataUserId || (await resolveUserIdFromCustomer(customerId));
  if (!userId) {
    return;
  }

  const existing = await getSupabaseAdminClient().from("entitlements").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error || !existing.data) {
    return;
  }

  await upsertEntitlement({
    user_id: userId,
    plan_type: existing.data.plan_type,
    status: "canceled",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    current_period_end: toIsoIfUnix(subscription.current_period_end),
    trial_starts_at: existing.data.trial_starts_at,
    trial_ends_at: existing.data.trial_ends_at,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
  if (!customerId || !subscriptionId) {
    return;
  }

  const userId = await resolveUserIdFromCustomer(customerId);
  if (!userId) {
    return;
  }

  const existing = await getSupabaseAdminClient().from("entitlements").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error || !existing.data) {
    return;
  }

  await upsertEntitlement({
    user_id: userId,
    plan_type: existing.data.plan_type,
    status: "past_due",
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    current_period_end: existing.data.current_period_end,
    trial_starts_at: existing.data.trial_starts_at,
    trial_ends_at: existing.data.trial_ends_at,
  });
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    return NextResponse.json({ error: "Invalid webhook signature", detail: String(error) }, { status: 400 });
  }

  try {
    // Stripe is source-of-truth for paid entitlement lifecycle.
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
    }
    if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    }
    if (event.type === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    }
  } catch (error) {
    return NextResponse.json({ error: "Webhook handling failed", detail: String(error) }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
