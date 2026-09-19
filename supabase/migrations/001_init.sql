-- India Job OS schema. Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  location text not null default '',
  linkedin_url text not null default '',
  github_url text not null default '',
  portfolio_url text not null default '',
  summary text not null default '',
  skills text[] not null default '{}',
  target_roles text[] not null default '{}',
  cities text[] not null default '{}',
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title text not null,
  company text not null,
  location text not null default '',
  apply_url text not null,
  description text not null default '',
  salary text,
  posted_at timestamptz,
  remote boolean not null default false,
  tags text[] not null default '{}',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists jobs_company_title_idx on public.jobs (lower(company), lower(title));
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);

create table if not exists public.job_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  level_fit boolean not null default true,
  skill_overlap text[] not null default '{}',
  missing_skills text[] not null default '{}',
  rationale text not null default '',
  ranked_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists job_scores_user_score_idx on public.job_scores (user_id, score desc);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'saved'
    check (status in ('saved', 'queued', 'applied', 'interview', 'rejected', 'offer')),
  applied_at timestamptz,
  notes text not null default '',
  queue_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists applications_user_status_idx on public.applications (user_id, status);
create index if not exists applications_user_queue_date_idx on public.applications (user_id, queue_date);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  summary text not null default '',
  skills text[] not null default '{}',
  experience jsonb not null default '[]'::jsonb,
  cover_letter text not null default '',
  pdf_path text,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stat_date date not null,
  queued integer not null default 0,
  applied integer not null default 0,
  target integer not null default 40,
  unique (user_id, stat_date)
);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_scores enable row level security;
alter table public.applications enable row level security;
alter table public.resume_versions enable row level security;
alter table public.daily_stats enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "jobs_read" on public.jobs;
create policy "jobs_read" on public.jobs
  for select using (true);

drop policy if exists "job_scores_own" on public.job_scores;
create policy "job_scores_own" on public.job_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "applications_own" on public.applications;
create policy "applications_own" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "resume_versions_own" on public.resume_versions;
create policy "resume_versions_own" on public.resume_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_stats_own" on public.daily_stats;
create policy "daily_stats_own" on public.daily_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resumes_own" on storage.objects;
create policy "resumes_own" on storage.objects
  for all using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
