-- Create table for category emojis
create table if not exists categoria_emojis (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users not null,
  categoria text not null,
  emoji text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, categoria)
);

-- Enable RLS
alter table categoria_emojis enable row level security;

-- RLS Policies
create policy "Users can view own category emojis"
  on categoria_emojis for select
  using (auth.uid() = user_id);

create policy "Users can insert own category emojis"
  on categoria_emojis for insert
  with check (auth.uid() = user_id);

create policy "Users can update own category emojis"
  on categoria_emojis for update
  using (auth.uid() = user_id);

create policy "Users can delete own category emojis"
  on categoria_emojis for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists idx_categoria_emojis_user_id on categoria_emojis(user_id);
