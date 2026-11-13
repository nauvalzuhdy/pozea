-- Pozea initial schema. Applied with the Supabase CLI (`supabase db push`).
-- Rule: migrations only add. Drop a column only after no released app version reads it.

-- Pose catalog: readable by everyone once published, written only with the service role.
create table public.poses (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  photo_types    text[] not null,  -- values from apps/mobile/src/features/setup/options.ts
  places         text[] not null,
  aspect_ratios  text[] not null,
  difficulty     smallint not null default 1,
  thumbnail_key  text not null,    -- R2 object key, never a full URL
  template       jsonb not null,   -- target joint angles, tolerances, weights
  cues           jsonb not null,   -- instruction bubble copy per joint or condition
  match          jsonb not null default '{"enter":0.85,"exit":0.75,"hold_ms":600}',
  schema_version smallint not null default 1,
  published      boolean not null default false,
  updated_at     timestamptz not null default now()
);
create index poses_photo_types_idx on public.poses using gin (photo_types);
create index poses_places_idx on public.poses using gin (places);
create index poses_updated_at_idx on public.poses (updated_at);

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.favorites (
  user_id    uuid not null references auth.users on delete cascade,
  pose_id    uuid not null references public.poses on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pose_id)
);

-- Written only by Edge Functions (service role) to cap AI requests per user per day.
create table public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  count   int not null default 0,
  primary key (user_id, day)
);

-- Row Level Security: every table is locked by default; policies open only what each role needs.
alter table public.poses     enable row level security;
alter table public.profiles  enable row level security;
alter table public.favorites enable row level security;
alter table public.ai_usage  enable row level security;

create policy "published poses are public"
  on public.poses for select
  using (published);

create policy "read own profile"   on public.profiles for select using (id = auth.uid());
create policy "insert own profile" on public.profiles for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "read own favorites"   on public.favorites for select using (user_id = auth.uid());
create policy "add own favorites"    on public.favorites for insert with check (user_id = auth.uid());
create policy "remove own favorites" on public.favorites for delete using (user_id = auth.uid());

-- ai_usage has no policies: clients cannot read or write it, only the service role can.
