-- Server-side cache of DeepSeek cue variations, one row per pose. Written and read only by the
-- cue-phrases Edge Function with the service role, so RLS stays on with no policies.
create table public.cue_phrases (
  slug       text primary key,
  phrases    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cue_phrases enable row level security;
