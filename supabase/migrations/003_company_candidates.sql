-- Company candidates harvested from India job searches (Phase 4 growth).
-- Run after 002_companies_crawler.sql in the Supabase SQL editor.

create table if not exists public.company_candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text not null default '',
  career_url text not null default '',
  source text not null default 'search',
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'onboarded', 'rejected')),
  job_count integer not null default 0,
  discovery jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_candidates_status_idx
  on public.company_candidates (status, job_count desc);

alter table public.company_candidates enable row level security;

drop policy if exists "company_candidates_read" on public.company_candidates;
create policy "company_candidates_read"
  on public.company_candidates for select
  using (true);
