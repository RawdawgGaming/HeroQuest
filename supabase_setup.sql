-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

create table public.characters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  hero_class text not null,
  level int default 1,
  gold int default 0,
  diamonds int default 0,
  created_at timestamptz default now(),

  -- Enforce globally unique character names
  constraint characters_name_unique unique (name)
);

-- Row-level security: users can only see/modify their own characters
alter table public.characters enable row level security;

create policy "Users can view their own characters"
  on public.characters for select
  using (auth.uid() = user_id);

create policy "Users can insert their own characters"
  on public.characters for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own characters"
  on public.characters for update
  using (auth.uid() = user_id);

create policy "Users can delete their own characters"
  on public.characters for delete
  using (auth.uid() = user_id);

-- Allow checking name uniqueness without auth (for the name check endpoint)
create policy "Anyone can check if a name exists"
  on public.characters for select
  using (true);
