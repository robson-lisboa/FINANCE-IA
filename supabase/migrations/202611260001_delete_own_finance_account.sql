-- Execute this migration in the Supabase SQL Editor.
-- The function deletes the authenticated user's financial records and Auth account
-- in one PostgreSQL transaction. If any statement fails, the whole operation rolls back.
create or replace function public.delete_own_finance_account()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  requesting_user_id uuid := auth.uid();
begin
  if requesting_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.transactions where user_id = requesting_user_id;
  delete from public.financial_goals where user_id = requesting_user_id;
  delete from auth.users where id = requesting_user_id;

  return found;
end;
$$;

revoke all on function public.delete_own_finance_account() from public;
grant execute on function public.delete_own_finance_account() to authenticated;
