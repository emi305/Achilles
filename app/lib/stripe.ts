import Stripe from "stripe";
import { requireEnv } from "./supabase/env";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return stripeClient;
}

export function getStripePriceIds() {
  return {
    monthly: requireEnv("STRIPE_PRICE_MONTHLY"),
    annual: requireEnv("STRIPE_PRICE_ANNUAL"),
  };
}
