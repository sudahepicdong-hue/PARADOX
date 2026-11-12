-- =====================================================================
-- PARADOX - Satu link absen untuk semua talent.
-- Talent membuka t.me/<bot> (tanpa kode), lalu memilih profilnya di bot.
--  * Username Telegram sama dengan username di profil -> langsung terhubung
--    (dikerjakan fungsi server talent-bot).
--  * Tidak sama -> masuk ke tabel permintaan, menunggu disetujui admin.
-- Link sekali pakai yang lama tetap bisa dipakai.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

create table if not exists public.talent_link_requests (
  id                 uuid primary key default gen_random_uuid(),
  talent_id          text not null references public.talents (id) on delete cascade,
  telegram_chat_id   bigint not null unique,  -- 1 akun Telegram = 1 permintaan aktif
  telegram_username  text,
  telegram_name      text,
  created_at         timestamptz not null default now()
);

alter table public.talent_link_requests enable row level security;
-- Tidak ada policy: hanya lewat fungsi di bawah & fungsi server talent-bot.

-- Kirim kabar ke talent lewat bot (fungsi talent-bot, dikunci secret yang sama dengan notify-admin)
create or replace function private.talent_bot_push(p_event text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_url text;
  v_secret text;
begin
  select replace(value, '/notify-admin', '/talent-bot') into v_url from private.app_config where key = 'notify_url';
  select value into v_secret from private.app_config where key = 'notify_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('internal', p_event, 'data', p_data),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-telegram-bot-api-secret-token', v_secret),
    timeout_milliseconds := 15000
  );
exception when others then
  raise warning 'talent_bot_push gagal: %', sqlerrm;
end;
$$;

revoke execute on function private.talent_bot_push(text, jsonb) from public, anon, authenticated;

-- Info sambungan: tambah username bot (untuk link umum) & daftar permintaan yang menunggu
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
    'bot_ready', exists (select 1 from private.app_config where key = 'talent_bot_username'),
    'bot_username', (select value from private.app_config where key = 'talent_bot_username'),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'username', r.telegram_username,
        'name', r.telegram_name,
        'created_at', r.created_at
      ) order by r.created_at)
      from public.talent_link_requests r
      where r.talent_id = p_talent_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Daftar semua permintaan yang menunggu (untuk badge di panel admin)
create or replace function public.admin_talent_link_requests()
returns table (id uuid, talent_id text, talent_name text, telegram_username text, telegram_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin.';
  end if;
  return query
    select r.id, r.talent_id, t.name, r.telegram_username, r.telegram_name, r.created_at
    from public.talent_link_requests r
    join public.talents t on t.id = r.talent_id
    order by r.created_at;
end;
$$;

-- Setujui permintaan: hubungkan akun Telegram itu ke talent
create or replace function public.approve_talent_link_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  r public.talent_link_requests%rowtype;
  v_name text;
begin
  select * into r from public.talent_link_requests where id = p_id;
  if not found then
    raise exception 'Permintaan tidak ditemukan (mungkin sudah diproses).';
  end if;
  if not public.can_broadcast(r.talent_id) then
    raise exception 'Anda tidak punya akses untuk talent ini.';
  end if;

  delete from public.talent_telegram_links where telegram_chat_id = r.telegram_chat_id or talent_id = r.talent_id;
  insert into public.talent_telegram_links (talent_id, telegram_chat_id, telegram_username)
  values (r.talent_id, r.telegram_chat_id, r.telegram_username);
  delete from public.talent_link_requests where id = r.id;

  select name into v_name from public.talents where id = r.talent_id;
  perform public.write_audit('talent.telegram_approve', 'talent', r.talent_id, v_name,
    jsonb_build_object('telegram_username', r.telegram_username));
  perform private.talent_bot_push('link_approved', jsonb_build_object('chat_id', r.telegram_chat_id, 'talent_id', r.talent_id));
end;
$$;

-- Tolak permintaan
create or replace function public.reject_talent_link_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  r public.talent_link_requests%rowtype;
begin
  select * into r from public.talent_link_requests where id = p_id;
  if not found then
    return;
  end if;
  if not public.can_broadcast(r.talent_id) then
    raise exception 'Anda tidak punya akses untuk talent ini.';
  end if;
  delete from public.talent_link_requests where id = r.id;
  perform private.talent_bot_push('link_rejected', jsonb_build_object('chat_id', r.telegram_chat_id));
end;
$$;

revoke execute on function public.admin_talent_link_requests() from public, anon;
revoke execute on function public.approve_talent_link_request(uuid) from public, anon;
revoke execute on function public.reject_talent_link_request(uuid) from public, anon;
grant execute on function public.admin_talent_link_requests() to authenticated;
grant execute on function public.approve_talent_link_request(uuid) to authenticated;
grant execute on function public.reject_talent_link_request(uuid) to authenticated;
