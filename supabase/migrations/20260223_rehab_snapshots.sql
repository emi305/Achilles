-- Rehab snapshots (progress/trend tracking)

create table if not exists public.rehab_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_snapshot_key text not null,
  exam_mode text not null check (exam_mode in ('comlex2', 'usmle_step2')),
  snapshot_at timestamptz not null,
  label text null,
  has_qbank_data boolean not null default false,
  has_score_report_data boolean not null default false,
  overall_roi double precision null,
  overall_proi double precision null,
  overall_avg_percent_correct double precision null,
  overall_attempted_count integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rehab_analysis_runs_overall_attempted_count_nonnegative
    check (overall_attempted_count is null or overall_attempted_count >= 0)
);

create unique index if not exists rehab_analysis_runs_user_snapshot_key_idx
  on public.rehab_analysis_runs (user_id, client_snapshot_key);

create index if not exists rehab_analysis_runs_user_exam_snapshot_at_idx
  on public.rehab_analysis_runs (user_id, exam_mode, snapshot_at desc);

create table if not exists public.rehab_analysis_categories (
  id bigserial primary key,
  run_id uuid not null references public.rehab_analysis_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_mode text not null check (exam_mode in ('comlex2', 'usmle_step2')),
  category_name text not null,
  category_type text not null check (
    category_type in (
      'competency_domain',
      'clinical_presentation',
      'discipline',
      'system',
      'physician_task',
      'uworld_subject',
      'uworld_system'
    )
  ),
  weight double precision null,
  roi double precision null,
  has_roi boolean not null default false,
  proi double precision null,
  has_proi boolean not null default false,
  avg_percent_correct double precision null,
  attempted_count integer null,
  created_at timestamptz not null default now(),
  constraint rehab_analysis_categories_attempted_count_nonnegative
    check (attempted_count is null or attempted_count >= 0),
  constraint rehab_analysis_categories_unique_per_run
    unique (run_id, category_type, category_name)
);

create index if not exists rehab_analysis_categories_run_idx
  on public.rehab_analysis_categories (run_id);

create index if not exists rehab_analysis_categories_user_exam_category_idx
  on public.rehab_analysis_categories (user_id, exam_mode, category_type, category_name);

drop trigger if exists rehab_analysis_runs_set_updated_at on public.rehab_analysis_runs;
create trigger rehab_analysis_runs_set_updated_at
before update on public.rehab_analysis_runs
for each row execute function public.set_updated_at();

alter table public.rehab_analysis_runs enable row level security;
alter table public.rehab_analysis_categories enable row level security;

drop policy if exists "rehab_runs_select_own" on public.rehab_analysis_runs;
create policy "rehab_runs_select_own" on public.rehab_analysis_runs
for select using (auth.uid() = user_id);

drop policy if exists "rehab_runs_insert_own" on public.rehab_analysis_runs;
create policy "rehab_runs_insert_own" on public.rehab_analysis_runs
for insert with check (auth.uid() = user_id);

drop policy if exists "rehab_runs_update_own" on public.rehab_analysis_runs;
create policy "rehab_runs_update_own" on public.rehab_analysis_runs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "rehab_categories_select_own" on public.rehab_analysis_categories;
create policy "rehab_categories_select_own" on public.rehab_analysis_categories
for select using (auth.uid() = user_id);

drop policy if exists "rehab_categories_insert_own" on public.rehab_analysis_categories;
create policy "rehab_categories_insert_own" on public.rehab_analysis_categories
for insert with check (auth.uid() = user_id);

drop policy if exists "rehab_categories_update_own" on public.rehab_analysis_categories;
create policy "rehab_categories_update_own" on public.rehab_analysis_categories
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "rehab_categories_delete_own" on public.rehab_analysis_categories;
create policy "rehab_categories_delete_own" on public.rehab_analysis_categories
for delete using (auth.uid() = user_id);

