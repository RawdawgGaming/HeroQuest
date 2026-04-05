-- Run this in your Supabase SQL Editor to add progression columns

alter table public.characters
  add column if not exists xp int default 0,
  add column if not exists progression jsonb default '{}'::jsonb;
