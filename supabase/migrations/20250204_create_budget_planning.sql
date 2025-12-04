-- Create table for budget planning
create table if not exists budget_planning (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users not null,
  categoria text not null,
  mes integer not null check (mes >= 1 and mes <= 12),
  ano integer not null,
  meta decimal(10,2) not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, categoria, mes, ano)
);

-- Enable RLS
alter table budget_planning enable row level security;

-- RLS Policies
create policy "Users can view own budget planning"
  on budget_planning for select
  using (auth.uid() = user_id);

create policy "Users can insert own budget planning"
  on budget_planning for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budget planning"
  on budget_planning for update
  using (auth.uid() = user_id);

create policy "Users can delete own budget planning"
  on budget_planning for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists idx_budget_planning_user_id on budget_planning(user_id);
create index if not exists idx_budget_planning_user_ano on budget_planning(user_id, ano);
