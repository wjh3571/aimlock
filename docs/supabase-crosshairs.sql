create table if not exists public.crosshairs (
  id text primary key,
  title text not null,
  author text not null,
  type text not null,
  category text not null,
  tags jsonb not null default '[]'::jsonb,
  "copyCount" integer not null default 0,
  "postedAt" timestamptz not null,
  code text not null,
  thumb text,
  source text
);

alter table public.crosshairs enable row level security;

drop policy if exists "Public crosshair read" on public.crosshairs;
create policy "Public crosshair read"
on public.crosshairs
for select
to anon
using (true);
