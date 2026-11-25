create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0 check (saved_amount >= 0),
  deadline date not null,
  created_at timestamptz not null default now()
);
alter table public.financial_goals enable row level security;
drop policy if exists "Users manage their own financial goals" on public.financial_goals;
create policy "Users manage their own financial goals"
on public.financial_goals for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create index if not exists financial_goals_user_id_idx on public.financial_goals(user_id);
