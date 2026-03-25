-- SME Interview Studio — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Sessions table
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  topic text not null,
  status text not null default 'in-progress' check (status in ('in-progress', 'complete')),
  tweaked_questions jsonb not null default '[]'::jsonb,
  current_question integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Answers table
create table if not exists answers (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  question_number integer not null,
  question text not null,
  soundbite text not null default '',
  answer text not null,
  created_at timestamptz default now()
);

-- Index for fast session lookups
create index if not exists idx_answers_session_id on answers(session_id);

-- Enable RLS but allow all access (no auth)
alter table sessions enable row level security;
alter table answers enable row level security;

-- Allow anonymous read/write (since we're not doing auth)
create policy "Allow all access to sessions" on sessions
  for all using (true) with check (true);

create policy "Allow all access to answers" on answers
  for all using (true) with check (true);

-- Auto-update updated_at on sessions
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();
