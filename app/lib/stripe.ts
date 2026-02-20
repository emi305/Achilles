import Stripe from "stripe";
import { requireServerEnv } from "./supabase/env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  stripeClient = new Stripe(requireServerEnv("STRIPE_SECRET_KEY"));
  return stripeClient;
}

export function getStripePriceIds() {
  return {
    monthly: requireServerEnv("STRIPE_PRICE_MONTHLY"),
    threeMonth: requireServerEnv("STRIPE_PRICE_3MONTH_PRICE_ID"),
    annual: requireServerEnv("STRIPE_PRICE_ANNUAL"),
  };
}
