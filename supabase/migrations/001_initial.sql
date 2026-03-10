-- NPB Loaf Line Production Planner: use dedicated schema so one Supabase project can host multiple apps.
create schema if not exists apptest_prodplanner;

-- Plan: single row per "current plan" (plan_date + rows JSON).
-- Rows array shape: [{ id, product, soQty, theorOutput, capacity, procTime, startSponge, endDough, endBatch, batch }, ...]
create table if not exists apptest_prodplanner.plan (
  id uuid primary key default gen_random_uuid(),
  plan_date timestamptz not null default now(),
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table apptest_prodplanner.plan enable row level security;

create policy "Allow public read plan"
  on apptest_prodplanner.plan for select
  using (true);

create policy "Allow public update plan"
  on apptest_prodplanner.plan for update
  using (true)
  with check (true);

create policy "Allow public insert plan"
  on apptest_prodplanner.plan for insert
  with check (true);

-- Override requests from station live views; planner approves/rejects.
create table if not exists apptest_prodplanner.override_requests (
  id uuid primary key default gen_random_uuid(),
  station_id text not null check (station_id in ('mixing', 'makeup-dividing', 'makeup-panning', 'baking', 'packaging')),
  requested_at timestamptz not null default now(),
  requested_by text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz not null default now()
);

alter table apptest_prodplanner.override_requests enable row level security;

create policy "Allow public read override_requests"
  on apptest_prodplanner.override_requests for select
  using (true);

create policy "Allow public insert override_requests"
  on apptest_prodplanner.override_requests for insert
  with check (true);

create policy "Allow public update override_requests"
  on apptest_prodplanner.override_requests for update
  using (true)
  with check (true);

-- App configuration (recipes, production lines, etc.) stored as JSON by key.
create table if not exists apptest_prodplanner.config (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table apptest_prodplanner.config enable row level security;

create policy "Allow public read config"
  on apptest_prodplanner.config for select
  using (true);

create policy "Allow public insert config"
  on apptest_prodplanner.config for insert
  with check (true);

create policy "Allow public update config"
  on apptest_prodplanner.config for update
  using (true)
  with check (true);

-- Realtime: In Supabase Dashboard, go to Database > Replication and add
-- apptest_prodplanner.plan and apptest_prodplanner.override_requests to the supabase_realtime publication.
