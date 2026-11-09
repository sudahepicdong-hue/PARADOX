-- =====================================================================
-- PARADOX - Tabel profil user untuk login Supabase
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1. Tabel profiles: 1 baris per akun di auth.users
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text not null default '',
  email             text,
  role              text not null default 'user' check (role in ('user', 'talent', 'admin')),
  talent_id         text,                     -- diisi kalau role = 'talent' (contoh: 'talent-1')
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2. Otomatis bikin baris profiles setiap ada user baru daftar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 4. Keamanan (Row Level Security)
alter table public.profiles enable row level security;

drop policy if exists "Profil sendiri bisa dibaca" on public.profiles;
create policy "Profil sendiri bisa dibaca"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Profil sendiri bisa diubah" on public.profiles;
create policy "Profil sendiri bisa diubah"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User hanya boleh mengubah nama.
-- role dan talent_id TIDAK bisa diubah dari website (hanya lewat SQL / dashboard).
revoke update on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

-- Versi lama menyimpan like di kolom ini; sekarang pindah ke tabel public.likes.
alter table public.profiles drop column if exists liked_talent_ids;

-- 5. Isi profil untuk user yang sudah terdaftar sebelum tabel ini dibuat
insert into public.profiles (id, name, email)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
       u.email
from auth.users u
on conflict (id) do nothing;
