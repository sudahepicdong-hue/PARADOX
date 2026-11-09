-- =====================================================================
-- PARADOX - Notifikasi push "talent sedang live" ke HP/browser member
-- yang menyukai (like) talent tersebut.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1. Langganan push per perangkat (satu akun bisa punya beberapa HP/browser)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
-- Tidak ada policy: hanya diakses lewat fungsi di bawah & fungsi server push-live.

-- Simpan langganan perangkat ini untuk akun yang sedang login.
-- Kalau perangkat yang sama dipakai akun lain sebelumnya, langganannya dipindah ke akun ini.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Silakan login dulu.';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'Alamat langganan tidak valid.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;

-- 2. Kunci publik VAPID (dibutuhkan browser untuk berlangganan). Diisi oleh deploy script.
create or replace function public.get_vapid_public_key()
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select value from private.app_config where key = 'vapid_public_key';
$$;

grant execute on function public.get_vapid_public_key() to anon, authenticated;

-- 3. Anti-spam: kapan terakhir notifikasi live talent ini dikirim
alter table public.talents add column if not exists live_push_sent_at timestamptz;

-- 4. Panggil fungsi server mana saja (alamat dasar & kunci diisi deploy script)
create or replace function private.call_function(p_name text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_base text;
  v_secret text;
begin
  select value into v_base from private.app_config where key = 'functions_base_url';
  select value into v_secret from private.app_config where key = 'notify_secret';
  if v_base is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_base || '/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
exception when others then
  raise warning 'call_function % gagal: %', p_name, sqlerrm;
end;
$$;

revoke execute on function private.call_function(text, jsonb) from public, anon, authenticated;

-- 5. Saat talent mulai live: Telegram ke admin (sudah ada) + push ke member pengikut
create or replace function private.notify_on_live_start()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.is_live and not coalesce(old.is_live, false) then
    perform private.notify_admin('live_start', jsonb_build_object(
      'talent_id', new.id,
      'talent_name', new.name,
      'title', new.live_stream_title
    ));
    perform private.call_function('push-live', jsonb_build_object('talent_id', new.id));
  end if;
  return null;
end;
$$;
