-- =====================================================================
-- PARADOX - Pendaftaran calon talent dari website
-- Calon talent mengisi formulir (lewat Edge Function "talent-apply" yang memeriksa
-- verifikasi Cloudflare + umur 18+). Admin meninjau di Panel Admin -> Pendaftar.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1. Tabel pendaftar (hanya admin yang bisa melihat; pengisian lewat Edge Function)
create table if not exists public.talent_applications (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 60),
  birth_date        date not null,
  telegram_username text not null check (telegram_username ~ '^[A-Za-z0-9_]{5,32}$'),
  city              text not null default '' check (char_length(city) <= 60),
  about             text not null default '' check (char_length(about) <= 1000),
  photos            text[] not null default '{}', -- path file di bucket privat talent-applications
  status            text not null default 'baru' check (status in ('baru', 'dihubungi', 'diterima', 'ditolak')),
  talent_id         text references public.talents (id) on delete set null,
  ip_hash           text, -- untuk membatasi spam, bukan alamat IP asli
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid references auth.users (id) on delete set null
);

create index if not exists talent_applications_created_idx on public.talent_applications (created_at desc);
create index if not exists talent_applications_tele_idx on public.talent_applications (lower(telegram_username));
create index if not exists talent_applications_ip_idx on public.talent_applications (ip_hash, created_at);

alter table public.talent_applications enable row level security;

drop policy if exists "Admin lihat pendaftar" on public.talent_applications;
create policy "Admin lihat pendaftar"
  on public.talent_applications for select
  to authenticated
  using (public.is_admin());
-- Tidak ada policy insert/update/delete: pengisian lewat Edge Function (service role),
-- perubahan status & penghapusan lewat fungsi admin di bawah (tercatat di Riwayat).

revoke all on public.talent_applications from anon;

-- 2. Bucket PRIVAT untuk foto pendaftar (folder = id pendaftaran)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('talent-applications', 'talent-applications', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin lihat foto pendaftar" on storage.objects;
create policy "Admin lihat foto pendaftar"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'talent-applications' and public.is_admin());

drop policy if exists "Admin hapus foto pendaftar" on storage.objects;
create policy "Admin hapus foto pendaftar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'talent-applications' and public.is_admin());

-- 3. Ubah status (dihubungi / diterima / ditolak / kembali baru)
create or replace function public.admin_set_application_status(p_id uuid, p_status text, p_talent_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.talent_applications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengatur pendaftar.';
  end if;
  if p_status not in ('baru', 'dihubungi', 'diterima', 'ditolak') then
    raise exception 'Status tidak dikenal.';
  end if;

  update public.talent_applications
     set status = p_status,
         talent_id = coalesce(p_talent_id, talent_id),
         reviewed_at = case when p_status = 'baru' then null else now() end,
         reviewed_by = case when p_status = 'baru' then null else auth.uid() end
   where id = p_id
  returning * into app;

  if not found then
    raise exception 'Pendaftar tidak ditemukan.';
  end if;

  perform public.write_audit('application.' || p_status, 'application', app.id::text,
    app.name || ' (@' || app.telegram_username || ')');
end;
$$;

revoke execute on function public.admin_set_application_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_application_status(uuid, text, text) to authenticated;

-- 4. Hapus data pendaftar (foto dihapus dari website oleh admin sebelum memanggil ini)
create or replace function public.admin_delete_application(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.talent_applications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menghapus pendaftar.';
  end if;
  delete from public.talent_applications where id = p_id returning * into app;
  if not found then
    raise exception 'Pendaftar tidak ditemukan.';
  end if;
  perform public.write_audit('application.delete', 'application', app.id::text,
    app.name || ' (@' || app.telegram_username || ')');
end;
$$;

revoke execute on function public.admin_delete_application(uuid) from public, anon;
grant execute on function public.admin_delete_application(uuid) to authenticated;

-- 5. Notifikasi Telegram ke admin saat ada pendaftar baru
create or replace function private.notify_on_application()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.notify_admin('talent_application', jsonb_build_object(
    'name', new.name,
    'age', date_part('year', age((now() at time zone 'Asia/Jakarta')::date, new.birth_date))::int,
    'city', new.city,
    'username', new.telegram_username,
    'photos', coalesce(array_length(new.photos, 1), 0)
  ));
  return null;
end;
$$;

drop trigger if exists notify_on_application on public.talent_applications;
create trigger notify_on_application
  after insert on public.talent_applications
  for each row execute function private.notify_on_application();
