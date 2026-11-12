-- =====================================================================
-- PARADOX - Admin tetap bisa menghubungi talent lewat ID Telegram.
--  * Nama & riwayat username Telegram talent dicatat (bukti kalau ada penipuan).
--  * Admin mengirim pesan ke talent lewat bot absen (pakai ID, bukan username),
--    balasan talent diteruskan bot ke Telegram admin.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

alter table public.talent_telegram_links add column if not exists telegram_name text;

create table if not exists public.talent_username_history (
  id                bigint generated always as identity primary key,
  talent_id         text not null references public.talents (id) on delete cascade,
  telegram_chat_id  bigint not null,
  old_username      text,
  new_username      text,  -- null = username dihapus
  changed_at        timestamptz not null default now()
);

create index if not exists talent_username_history_talent_idx on public.talent_username_history (talent_id, changed_at desc);

alter table public.talent_username_history enable row level security;
-- Tidak ada policy: dibaca lewat fungsi talent_telegram_info, ditulis oleh fungsi server talent-bot.

-- Info sambungan: tambah ID, nama, status username & riwayat (khusus admin untuk ID & riwayat)
create or replace function public.talent_telegram_info(p_talent_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  l public.talent_telegram_links%rowtype;
  v_admin boolean := public.is_admin();
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses untuk talent ini.';
  end if;
  select * into l from public.talent_telegram_links where talent_id = p_talent_id;
  return jsonb_build_object(
    'linked', l.talent_id is not null,
    'username', l.telegram_username,
    'linked_at', l.linked_at,
    'username_missing_since', l.username_missing_since,
    'telegram_id', case when v_admin then l.telegram_chat_id end,
    'telegram_name', case when v_admin then l.telegram_name end,
    'history', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'old', h.old_username, 'new', h.new_username, 'at', h.changed_at
      ) order by h.changed_at desc)
      from (
        select * from public.talent_username_history
        where talent_id = p_talent_id
        order by changed_at desc
        limit 20
      ) h
    ), '[]'::jsonb) else '[]'::jsonb end,
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

-- Admin kirim pesan ke talent lewat bot absen (pakai ID Telegram)
create or replace function public.admin_message_talent(p_talent_id text, p_text text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_chat bigint;
  v_name text;
  v_text text := btrim(coalesce(p_text, ''));
begin
  if not public.is_admin() then
    raise exception 'Hanya admin.';
  end if;
  if length(v_text) = 0 or length(v_text) > 3000 then
    raise exception 'Pesan harus 1–3000 karakter.';
  end if;
  select telegram_chat_id into v_chat from public.talent_telegram_links where talent_id = p_talent_id;
  if v_chat is null then
    raise exception 'Talent ini belum terhubung ke bot Telegram.';
  end if;
  select name into v_name from public.talents where id = p_talent_id;
  perform public.write_audit('talent.telegram_message', 'talent', p_talent_id, v_name,
    jsonb_build_object('text', left(v_text, 500)));
  perform private.talent_bot_push('admin_message', jsonb_build_object('chat_id', v_chat, 'text', v_text));
end;
$$;

revoke execute on function public.admin_message_talent(text, text) from public, anon;
grant execute on function public.admin_message_talent(text, text) to authenticated;
