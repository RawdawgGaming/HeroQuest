-- Run this in your Supabase SQL Editor to add stage tracking

alter table public.characters
  add column if not exists current_stage int default 0;
