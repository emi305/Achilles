-- Achilles Insight auth + entitlement schema

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  email text not null,
  email_verified boolean not null default false,
  school_domain text null,
  is_vcom_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_type text not null check (plan_type in ('vcom_free', 'trial', 'pro_monthly', 'pro_3month', 'pro_annual')),
  status text not null check (status in ('active', 'inactive', 'past_due', 'canceled', 'expired')),
  trial_starts_at timestamptz null,
  trial_ends_at timestamptz null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  current_period_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists entitlements_stripe_customer_id_idx on public.entitlements (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists entitlements_stripe_subscription_id_idx on public.entitlements (stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.allowed_domains (
  domain text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.allowed_domains (domain, active)
values ('vcom.edu', true)
on conflict (domain) do update set active = excluded.active, updated_at = now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

drop trigger if exists allowed_domains_set_updated_at on public.allowed_domains;
create trigger allowed_domains_set_updated_at
before update on public.allowed_domains
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.allowed_domains enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
for select using (auth.uid() = user_id);

drop policy if exists "allowed_domains_select_all" on public.allowed_domains;
create policy "allowed_domains_select_all" on public.allowed_domains
for select using (true);
