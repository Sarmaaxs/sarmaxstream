-- Run once in Supabase -> SQL Editor. Safe to run again.

-- 1) Row-level security for the two tables the repo never defined.
alter table if exists public.watchlist_items   enable row level security;
alter table if exists public.continue_watching enable row level security;

drop policy if exists "watchlist_items_own" on public.watchlist_items;
create policy "watchlist_items_own" on public.watchlist_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "continue_watching_own" on public.continue_watching;
create policy "continue_watching_own" on public.continue_watching
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2) delete_my_account(): only signed-in users may call it, and it gets a fixed search_path.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_my_account'
  ) then
    revoke all on function public.delete_my_account() from public, anon;
    grant execute on function public.delete_my_account() to authenticated;
    alter function public.delete_my_account() set search_path = public, pg_temp;
  end if;
end $$;

-- 3) READ THESE RESULTS. Policies are OR-ed together: one old "using (true)" policy
--    on a table cancels every good policy on it. Delete anything loose you see.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- delete_my_account should show prosecdef = true and proconfig containing search_path.
select proname, prosecdef, proconfig from pg_proc
where proname = 'delete_my_account' and pronamespace = 'public'::regnamespace;
