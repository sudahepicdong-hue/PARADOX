-- =====================================================================
-- PARADOX - Status Online/Offline talent lewat bot Telegram khusus talent.
-- Talent menghubungkan akun Telegram-nya sekali (link sekali pakai, berlaku 7 hari),
-- lalu cukup kirim /online atau /offline ke bot.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1. Status online: talent dianggap online selama online_until masih di masa depan
--    (otomatis kembali offline kalau talent lupa mengirim /offline)
alter table public.talents add column if not exists online_until timestamptz;

-- 2. Akun Telegram yang terhubung ke talent (1 talent = 1 akun Telegram)
create table if not exists public.talent_telegram_links (
  talent_id          text primary key references public.talents (id) on delete cascade,
  telegram_chat_id   bigint not null unique,
  telegram_username  text,
  linked_at          timestamptz not null default now()
);

alter table public.talent_telegram_links enable row level security;
-- Tidak ada policy: hanya lewat fungsi di bawah & fungsi server talent-bot.

-- 3. Kode link sekali pakai
create table if not exists public.talent_link_codes (
  code        text primary key,
  talent_id   text not null references public.talents (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

alter table public.talent_link_codes enable row level security;

-- Admin / talent pemilik membuat link baru (link lama yang belum dipakai otomatis batal)
create or replace function public.create_talent_link_code(p_talent_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_code text;
  v_expires timestamptz := now() + interval '7 days';
  v_bot text;
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses untuk talent ini.';
  end if;

  select value into v_bot from private.app_config where key = 'talent_bot_username';
  if v_bot is null then
    raise exception 'Bot Telegram talent belum diatur di server. Hubungi admin.';
  end if;

  delete from public.talent_link_codes where talent_id = p_talent_id and used_at is null;

  -- 16 karakter acak (64 bit) -> praktis mustahil ditebak
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

  insert into public.talent_link_codes (code, talent_id, created_by, expires_at)
  values (v_code, p_talent_id, auth.uid(), v_expires);

  return jsonb_build_object(
    'url', 'https://t.me/' || v_bot || '?start=' || v_code,
    'expires_at', v_expires
  );
end;
$$;

-- Status sambungan Telegram talent (untuk panel admin & Profil Saya)
create or replace function public.talent_telegram_info(p_talent_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses untuk talent ini.';
  end if;
  return jsonb_build_object(
    'linked', exists (select 1 from public.talent_telegram_links where talent_id = p_talent_id),
    'username', (select telegram_username from public.talent_telegram_links where talent_id = p_talent_id),
    'linked_at', (select linked_at from public.talent_telegram_links where talent_id = p_talent_id),
    'pending_expires_at', (
      select max(expires_at) from public.talent_link_codes
      where talent_id = p_talent_id and used_at is null and expires_at > now()
    ),
    'bot_ready', exists (select 1 from private.app_config where key = 'talent_bot_username')
  );
end;
$$;

-- Putuskan sambungan Telegram talent (status juga dikembalikan ke offline)
create or replace function public.unlink_talent_telegram(p_talent_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses untuk talent ini.';
  end if;
  delete from public.talent_telegram_links where talent_id = p_talent_id;
  delete from public.talent_link_codes where talent_id = p_talent_id and used_at is null;
  update public.talents set online_until = null where id = p_talent_id;
end;
$$;

revoke execute on function public.create_talent_link_code(text) from public, anon;
revoke execute on function public.talent_telegram_info(text) from public, anon;
revoke execute on function public.unlink_talent_telegram(text) from public, anon;
grant execute on function public.create_talent_link_code(text) to authenticated;
grant execute on function public.talent_telegram_info(text) to authenticated;
grant execute on function public.unlink_talent_telegram(text) to authenticated;
