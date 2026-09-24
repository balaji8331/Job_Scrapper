-- Companies + crawler metadata for portal detection / ATS connectors.
-- Run after 001_init.sql in the Supabase SQL editor.
-- Service role (this app) bypasses RLS; policies cover future Auth clients.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text not null default 'India',
  career_url text not null default '',
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_active_idx on public.companies (active) where active;

-- ---------------------------------------------------------------------------
-- crawler_sources — one (or more) career portal configs per company
-- portal_type drives connector selection: greenhouse | lever | ashby |
-- workable | workday | generic | unknown
-- ---------------------------------------------------------------------------
create table if not exists public.crawler_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default '',
  career_url text not null,
  portal_type text not null default 'unknown'
    check (portal_type in (
      'greenhouse',
      'lever',
      'ashby',
      'workable',
      'workday',
      'successfactors',
      'taleo',
      'generic',
      'unknown'
    )),
  ats_slug text,
  country text not null default 'India',
  preferred_cities text[] not null default '{Bengaluru,Hyderabad,Chennai}',
  preferred_roles text[] not null default '{}',
  job_link_patterns text[] not null default '{}',
  config jsonb not null default '{}'::jsonb,
  discovery jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_detected_at timestamptz,
  last_crawled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, career_url)
);

create index if not exists crawler_sources_company_idx on public.crawler_sources (company_id);
create index if not exists crawler_sources_portal_idx on public.crawler_sources (portal_type);
create index if not exists crawler_sources_active_idx on public.crawler_sources (active) where active;

-- ---------------------------------------------------------------------------
-- crawler_runs — audit / rate-limit / self-learning history
-- ---------------------------------------------------------------------------
create table if not exists public.crawler_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.crawler_sources(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  jobs_found integer not null default 0,
  jobs_upserted integer not null default 0,
  error text not null default '',
  meta jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists crawler_runs_source_started_idx
  on public.crawler_runs (source_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Extend jobs for crawler linkage (keeps existing unique(source, external_id))
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table public.jobs
  add column if not exists source_url text;

alter table public.jobs
  add column if not exists employment_type text not null default '';

alter table public.jobs
  add column if not exists content_hash text;

alter table public.jobs
  add column if not exists status text not null default 'active'
    check (status in ('active', 'closed', 'stale'));

alter table public.jobs
  add column if not exists first_seen_at timestamptz not null default now();

alter table public.jobs
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists jobs_company_id_idx on public.jobs (company_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_content_hash_idx on public.jobs (content_hash);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.crawler_sources enable row level security;
alter table public.crawler_runs enable row level security;

drop policy if exists "companies_read" on public.companies;
create policy "companies_read" on public.companies
  for select using (true);

drop policy if exists "crawler_sources_read" on public.crawler_sources;
create policy "crawler_sources_read" on public.crawler_sources
  for select using (true);

drop policy if exists "crawler_runs_read" on public.crawler_runs;
create policy "crawler_runs_read" on public.crawler_runs
  for select using (true);

-- ---------------------------------------------------------------------------
-- Seed India majors (portal_type unknown until detector / YAML fills it)
-- ---------------------------------------------------------------------------
insert into public.companies (name, slug, career_url, notes)
values
  ('TCS', 'tcs', 'https://www.tcs.com/careers', 'India MNC — detect career portal'),
  ('Infosys', 'infosys', 'https://www.infosys.com/careers/', 'India MNC — detect career portal'),
  ('Wipro', 'wipro', 'https://careers.wipro.com/', 'India MNC — detect career portal'),
  ('Accenture', 'accenture', 'https://www.accenture.com/in-en/careers', 'India MNC — detect career portal'),
  ('Capgemini', 'capgemini', 'https://www.capgemini.com/in-en/careers/', 'India MNC — detect career portal'),
  ('Cognizant', 'cognizant', 'https://careers.cognizant.com/in/en', 'India MNC — detect career portal'),
  ('HCLTech', 'hcltech', 'https://www.hcltech.com/careers', 'India MNC — detect career portal'),
  ('Tech Mahindra', 'tech-mahindra', 'https://careers.techmahindra.com/', 'India MNC — detect career portal'),
  ('IBM', 'ibm', 'https://www.ibm.com/careers/in-en', 'India hiring — detect career portal'),
  ('Oracle', 'oracle', 'https://careers.oracle.com/', 'India hiring — detect career portal')
on conflict (slug) do update
set
  career_url = excluded.career_url,
  notes = excluded.notes,
  updated_at = now();

insert into public.crawler_sources (
  company_id,
  name,
  career_url,
  portal_type,
  preferred_cities,
  preferred_roles
)
select
  c.id,
  c.name || ' careers',
  c.career_url,
  'unknown',
  array['Bengaluru', 'Hyderabad', 'Chennai'],
  array['Backend Engineer', 'Software Engineer', 'Full Stack Engineer']
from public.companies c
where c.slug in (
  'tcs',
  'infosys',
  'wipro',
  'accenture',
  'capgemini',
  'cognizant',
  'hcltech',
  'tech-mahindra',
  'ibm',
  'oracle'
)
on conflict (company_id, career_url) do update
set
  preferred_cities = excluded.preferred_cities,
  preferred_roles = excluded.preferred_roles,
  updated_at = now();
