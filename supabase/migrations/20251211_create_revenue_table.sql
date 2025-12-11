-- Create Financeiro Receita table
create table if not exists "Financeiro Receita" (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users not null,
  "Responsavel" text,
  "Categoria" text,
  "Descrição" text,
  "Data" text, -- Storing as DD/MM/YYYY to match other tables convention
  valor numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table "Financeiro Receita" enable row level security;

-- Create Policy
create policy "Users can only see their own revenue"
  on "Financeiro Receita" for all
  using (auth.uid() = user_id);

-- Create Policy for Insert
create policy "Users can insert their own revenue"
  on "Financeiro Receita" for insert
  with check (auth.uid() = user_id);

-- Create Policy for Update
create policy "Users can update their own revenue"
  on "Financeiro Receita" for update
  using (auth.uid() = user_id);

-- Create Policy for Delete
create policy "Users can delete their own revenue"
  on "Financeiro Receita" for delete
  using (auth.uid() = user_id);
