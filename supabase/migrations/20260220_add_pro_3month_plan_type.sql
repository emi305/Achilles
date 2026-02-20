alter table public.entitlements
drop constraint if exists entitlements_plan_type_check;

alter table public.entitlements
add constraint entitlements_plan_type_check
check (plan_type in ('vcom_free', 'trial', 'pro_monthly', 'pro_3month', 'pro_annual'));
