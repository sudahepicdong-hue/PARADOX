-- =====================================================================
-- PARADOX - Kelola Admin dari Panel Admin
-- Admin bisa menjadikan / mencabut admin lewat email, tercatat di Riwayat.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1. Daftar admin
create or replace function public.admin_list_admins()
returns table (id uuid, name text, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh melihat daftar admin.';
  end if;
  return query
    select p.id, p.name, p.email, p.created_at
    from public.profiles p
    where p.role = 'admin'
    order by p.created_at;
end;
$$;

revoke execute on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

-- 2. Jadikan / cabut admin berdasarkan email
create or replace function public.admin_set_admin(p_email text, p_make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengatur admin.';
  end if;

  select * into target
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if not found then
    raise exception 'Email % belum terdaftar. Minta orangnya daftar dulu di website, lalu coba lagi.', trim(p_email);
  end if;

  if p_make_admin then
    if target.role = 'admin' then
      raise exception '% sudah menjadi admin.', target.email;
    end if;
    if target.role = 'talent' or target.email like '%@talent.paradox.invalid' then
      raise exception 'Akun talent tidak bisa dijadikan admin. Pakai akun email pribadi.';
    end if;
    update public.profiles set role = 'admin', talent_id = null, updated_at = now() where id = target.id;
    perform public.write_audit('admin.grant', 'account', target.id::text, coalesce(nullif(target.name, ''), target.email));
  else
    if target.role <> 'admin' then
      raise exception '% bukan admin.', target.email;
    end if;
    if target.id = auth.uid() then
      raise exception 'Tidak bisa mencabut admin dari akunmu sendiri.';
    end if;
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Harus ada minimal 1 admin.';
    end if;
    update public.profiles set role = 'user', updated_at = now() where id = target.id;
    perform public.write_audit('admin.revoke', 'account', target.id::text, coalesce(nullif(target.name, ''), target.email));
  end if;
end;
$$;

revoke execute on function public.admin_set_admin(text, boolean) from public, anon;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;
