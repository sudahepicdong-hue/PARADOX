-- =====================================================================
-- PARADOX - Verifikasi usia/identitas, profil dikelola talent sendiri,
-- laporan (report), dan status live real-time.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- Helper: ID talent milik user yang sedang login (null kalau bukan talent)
create or replace function public.my_talent_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select talent_id from public.profiles where id = auth.uid() and role = 'talent';
$$;

-- ---------------------------------------------------------------------
-- 1. Kolom baru di talents
-- ---------------------------------------------------------------------
-- is_active      : talent/admin bisa menyembunyikan profil tanpa menghapusnya
-- id_verified_at : diisi admin setelah memeriksa dokumen identitas 18+.
--                  Profil HANYA tampil ke publik kalau aktif DAN sudah terverifikasi.
alter table public.talents add column if not exists is_active boolean not null default true;
alter table public.talents add column if not exists id_verified_at timestamptz;

-- Siapa yang boleh melihat talent:
--   publik  -> hanya yang aktif & terverifikasi
--   admin   -> semua
--   talent  -> profilnya sendiri (walaupun belum terverifikasi / nonaktif)
drop policy if exists "Semua orang bisa lihat talent" on public.talents;
drop policy if exists "Talent tampil jika aktif dan terverifikasi" on public.talents;
create policy "Talent tampil jika aktif dan terverifikasi"
  on public.talents for select
  to anon, authenticated
  using (
    (is_active and id_verified_at is not null)
    or public.is_admin()
    or id = public.my_talent_id()
  );

-- Talent boleh mengubah & menghapus profilnya sendiri
drop policy if exists "Talent ubah profil sendiri" on public.talents;
create policy "Talent ubah profil sendiri"
  on public.talents for update
  to authenticated
  using (id = public.my_talent_id())
  with check (id = public.my_talent_id());

drop policy if exists "Talent hapus profil sendiri" on public.talents;
create policy "Talent hapus profil sendiri"
  on public.talents for delete
  to authenticated
  using (id = public.my_talent_id());

-- Kolom yang TIDAK boleh diubah talent sendiri (hanya admin / sistem):
-- id, angka like/rating/ulasan, status verifikasi, featured, dan usia (diambil dari dokumen).
-- Sengaja BUKAN security definer: current_user = 'authenticated' saat diubah langsung dari website.
create or replace function public.talents_protect_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  new.id             := old.id;
  new.likes_count    := old.likes_count;
  new.rating_average := old.rating_average;
  new.reviews_count  := old.reviews_count;
  new.id_verified_at := old.id_verified_at;
  new.verified       := old.verified;
  new.featured       := old.featured;
  new.age            := old.age;
  return new;
end;
$$;

drop trigger if exists talents_protect_columns on public.talents;
create trigger talents_protect_columns
  before update on public.talents
  for each row execute function public.talents_protect_columns();

-- ---------------------------------------------------------------------
-- 2. Dokumen identitas talent (PRIVAT, hanya admin)
-- ---------------------------------------------------------------------
create table if not exists public.talent_documents (
  id            uuid primary key default gen_random_uuid(),
  talent_id     text not null references public.talents (id) on delete cascade,
  doc_type      text not null check (doc_type in ('ktp', 'paspor', 'sim', 'lainnya')),
  birth_date    date not null,
  storage_path  text not null,
  uploaded_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists talent_documents_talent_id_idx on public.talent_documents (talent_id);

alter table public.talent_documents enable row level security;

drop policy if exists "Admin kelola dokumen" on public.talent_documents;
create policy "Admin kelola dokumen"
  on public.talent_documents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, delete on public.talent_documents to authenticated;

-- Verifikasi hanya bisa kalau sudah ada dokumen dengan tanggal lahir 18+.
-- Usia di profil otomatis diambil dari dokumen (bukan diketik manual).
create or replace function public.set_talent_verification(p_talent_id text, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_birth date;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang bisa memverifikasi talent.';
  end if;

  if p_verified then
    -- Pakai tanggal lahir paling muda dari semua dokumen (paling hati-hati)
    select max(birth_date) into v_birth from public.talent_documents where talent_id = p_talent_id;
    if v_birth is null then
      raise exception 'Belum ada dokumen identitas untuk talent ini.';
    end if;
    if v_birth > (current_date - interval '18 years') then
      raise exception 'Tanggal lahir di dokumen menunjukkan usia di bawah 18 tahun. Verifikasi ditolak.';
    end if;

    update public.talents
    set id_verified_at = now(),
        verified       = true,
        age            = date_part('year', age(current_date, v_birth))::int
    where id = p_talent_id;
  else
    update public.talents
    set id_verified_at = null,
        verified       = false
    where id = p_talent_id;
  end if;
end;
$$;

revoke execute on function public.set_talent_verification(text, boolean) from public, anon;
grant execute on function public.set_talent_verification(text, boolean) to authenticated;

-- Admin menghubungkan akun (email) ke profil talent, tanpa perlu SQL manual.
create or replace function public.admin_link_talent_account(p_email text, p_talent_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin.';
  end if;
  if not exists (select 1 from public.talents where id = p_talent_id) then
    raise exception 'Talent tidak ditemukan.';
  end if;

  -- Lepas akun lain yang sebelumnya terhubung ke talent ini
  update public.profiles set role = 'user', talent_id = null
  where talent_id = p_talent_id and role = 'talent' and lower(email) <> lower(trim(p_email));

  update public.profiles
  set role = 'talent', talent_id = p_talent_id
  where lower(email) = lower(trim(p_email)) and role <> 'admin';

  if not found then
    raise exception 'Akun dengan email itu belum terdaftar (minta talent daftar dulu di website), atau itu akun admin.';
  end if;
end;
$$;

create or replace function public.admin_talent_account_email(p_talent_id text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin.';
  end if;
  return (select email from public.profiles where talent_id = p_talent_id and role = 'talent' limit 1);
end;
$$;

revoke execute on function public.admin_link_talent_account(text, text) from public, anon;
grant execute on function public.admin_link_talent_account(text, text) to authenticated;
revoke execute on function public.admin_talent_account_email(text) from public, anon;
grant execute on function public.admin_talent_account_email(text) to authenticated;

-- Kalau talent dihapus, akun talent-nya kembali jadi member biasa
create or replace function public.talents_unlink_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set role = 'user', talent_id = null
  where talent_id = old.id and role = 'talent';
  return old;
end;
$$;

drop trigger if exists talents_unlink_accounts on public.talents;
create trigger talents_unlink_accounts
  after delete on public.talents
  for each row execute function public.talents_unlink_accounts();

-- ---------------------------------------------------------------------
-- 3. Storage
-- ---------------------------------------------------------------------
-- 3a. Bucket PRIVAT untuk dokumen identitas. File disimpan di folder <talent_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('talent-documents', 'talent-documents', false, 10485760, array['image/*', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin upload dokumen" on storage.objects;
create policy "Admin upload dokumen"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'talent-documents' and public.is_admin());

-- Admin bisa lihat semua; talent hanya bisa lihat/hapus dokumennya sendiri (dipakai saat hapus profil)
drop policy if exists "Lihat dokumen" on storage.objects;
create policy "Lihat dokumen"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'talent-documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

drop policy if exists "Hapus dokumen" on storage.objects;
create policy "Hapus dokumen"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'talent-documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

-- 3b. Media publik: talent sekarang juga boleh upload ke folder <talent_id>/ miliknya
drop policy if exists "Admin upload talent-media" on storage.objects;
drop policy if exists "Admin ubah talent-media" on storage.objects;
drop policy if exists "Admin hapus talent-media" on storage.objects;
drop policy if exists "Upload talent-media" on storage.objects;
drop policy if exists "Lihat daftar talent-media" on storage.objects;
drop policy if exists "Ubah talent-media" on storage.objects;
drop policy if exists "Hapus talent-media" on storage.objects;

create policy "Upload talent-media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'talent-media'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

create policy "Lihat daftar talent-media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'talent-media'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

create policy "Ubah talent-media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'talent-media'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

create policy "Hapus talent-media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'talent-media'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

-- ---------------------------------------------------------------------
-- 4. Laporan (report) profil & ulasan
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('talent', 'review')),
  talent_id    text references public.talents (id) on delete cascade,
  review_id    uuid references public.reviews (id) on delete cascade,
  reason       text not null check (reason in ('underage', 'coercion', 'fake', 'inappropriate', 'spam', 'other')),
  details      text not null default '' check (char_length(details) <= 2000),
  reporter_id  uuid default auth.uid() references auth.users (id) on delete set null,
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (
    (target_type = 'talent' and talent_id is not null)
    or (target_type = 'review' and review_id is not null)
  )
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Siapa saja (termasuk pengunjung yang belum login) boleh mengirim laporan
drop policy if exists "Siapa saja bisa melapor" on public.reports;
create policy "Siapa saja bisa melapor"
  on public.reports for insert
  to anon, authenticated
  with check (
    status = 'open'
    and resolved_at is null
    and (reporter_id is null or reporter_id = auth.uid())
  );

drop policy if exists "Admin kelola laporan" on public.reports;
create policy "Admin kelola laporan"
  on public.reports for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admin ubah laporan" on public.reports;
create policy "Admin ubah laporan"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin hapus laporan" on public.reports;
create policy "Admin hapus laporan"
  on public.reports for delete
  to authenticated
  using (public.is_admin());

grant insert on public.reports to anon, authenticated;
grant select, update, delete on public.reports to authenticated;

-- ---------------------------------------------------------------------
-- 5. Real-time: perubahan tabel talents langsung dikirim ke semua pengunjung
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talents'
     ) then
    alter publication supabase_realtime add table public.talents;
  end if;
end;
$$;
