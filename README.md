# Achilles
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Auth + Billing Setup

### Required environment variables

1. Copy `.env.example` to `.env.local`.
2. Replace all placeholder values in `.env.local`.
3. Restart the dev server after any `.env.local` change.

```bash
cp .env.example .env.local
```

Core auth/billing variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3100
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_3MONTH_PRICE_ID=price_xxx
STRIPE_PRICE_ANNUAL=price_xxx
```

Where to find values:
- Supabase: Dashboard -> Project Settings -> API
- Stripe API keys: Dashboard -> Developers -> API keys
- Stripe webhook secret: Dashboard -> Developers -> Webhooks (or `stripe listen` output)
- Stripe prices: Dashboard -> Product catalog -> Price IDs

### Database migration

Run `supabase/migrations/20260220_auth_entitlements_stripe.sql` in your Supabase SQL editor (or via your migration workflow) to create:

- `profiles`
- `entitlements`
- `allowed_domains` (seeded with `vcom.edu`)

### Stripe webhook local testing

1. Run the app: `npm run dev`
2. In another terminal, run Stripe CLI forwarding:
   `stripe listen --forward-to localhost:3100/api/stripe/webhook`
3. Copy the webhook secret from Stripe CLI output into `STRIPE_WEBHOOK_SECRET`.
4. Trigger test events:
   `stripe trigger checkout.session.completed`
   `stripe trigger customer.subscription.updated`
   `stripe trigger invoice.payment_failed`
