-- =====================================================================
-- PARADOX - Daftar talent untuk dropdown di form "Login Talent".
-- Hanya talent yang sudah dibuatkan login oleh admin yang muncul.
-- Yang dikirim ke browser hanya id + nama panggilan (tanpa email).
-- =====================================================================
create or replace function public.talent_login_options()
returns table (id text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, coalesce(nullif(t.alias, ''), t.name) as name
  from public.talents t
  where exists (
    select 1 from public.profiles p
    where p.talent_id = t.id
      and p.role = 'talent'
      and p.email like '%@talent.paradox.invalid'
  )
  order by 2;
$$;

revoke execute on function public.talent_login_options() from public;
grant execute on function public.talent_login_options() to anon, authenticated;
