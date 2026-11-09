-- =====================================================================
-- PARADOX - Moderasi chat live, jadwal live, statistik, dokumen dari talent,
-- dan notifikasi Telegram ke admin.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MODERASI: penonton yang diblokir dari siaran talent tertentu
--    (ditambah lewat fungsi server "live-moderate", dihapus/unblock dari website)
-- ---------------------------------------------------------------------
create table if not exists public.live_bans (
  talent_id   text not null references public.talents (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  user_name   text not null default '',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (talent_id, user_id)
);

alter table public.live_bans enable row level security;

drop policy if exists "Host lihat daftar blokir" on public.live_bans;
create policy "Host lihat daftar blokir"
  on public.live_bans for select
  to authenticated
  using (public.is_admin() or talent_id = public.my_talent_id());

drop policy if exists "Host buka blokir" on public.live_bans;
create policy "Host buka blokir"
  on public.live_bans for delete
  to authenticated
  using (public.is_admin() or talent_id = public.my_talent_id());

grant select, delete on public.live_bans to authenticated;

-- Catat "buka blokir" di riwayat (blokir dicatat oleh fungsi server)
create or replace function public.audit_live_bans()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  perform public.write_audit(
    'live.unban', 'talent', old.talent_id,
    (select name from public.talents where id = old.talent_id),
    jsonb_build_object('viewer', old.user_name)
  );
  return null;
end;
$$;

drop trigger if exists audit_live_bans on public.live_bans;
create trigger audit_live_bans
  after delete on public.live_bans
  for each row execute function public.audit_live_bans();

-- ---------------------------------------------------------------------
-- 2. JADWAL LIVE
-- ---------------------------------------------------------------------
create table if not exists public.live_schedules (
  id          uuid primary key default gen_random_uuid(),
  talent_id   text not null references public.talents (id) on delete cascade,
  starts_at   timestamptz not null,
  note        text not null default '' check (char_length(note) <= 120),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists live_schedules_starts_idx on public.live_schedules (starts_at);

alter table public.live_schedules enable row level security;

-- Publik hanya melihat jadwal talent yang tampil di katalog
drop policy if exists "Lihat jadwal live" on public.live_schedules;
create policy "Lihat jadwal live"
  on public.live_schedules for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.talents t
      where t.id = talent_id and t.is_active and t.id_verified_at is not null
    )
    or public.is_admin()
    or talent_id = public.my_talent_id()
  );

drop policy if exists "Tambah jadwal live" on public.live_schedules;
create policy "Tambah jadwal live"
  on public.live_schedules for insert
  to authenticated
  with check (
    (public.is_admin() or talent_id = public.my_talent_id())
    and starts_at > now() - interval '1 hour'
    and starts_at < now() + interval '60 days'
  );

drop policy if exists "Hapus jadwal live" on public.live_schedules;
create policy "Hapus jadwal live"
  on public.live_schedules for delete
  to authenticated
  using (public.is_admin() or talent_id = public.my_talent_id());

grant select on public.live_schedules to anon, authenticated;
grant insert, delete on public.live_schedules to authenticated;

-- ---------------------------------------------------------------------
-- 3. TALENT UPLOAD DOKUMEN IDENTITAS SENDIRI
--    (verifikasi tetap hanya bisa dilakukan admin)
-- ---------------------------------------------------------------------
drop policy if exists "Talent lihat dokumen sendiri" on public.talent_documents;
create policy "Talent lihat dokumen sendiri"
  on public.talent_documents for select
  to authenticated
  using (talent_id = public.my_talent_id());

drop policy if exists "Talent upload dokumen sendiri" on public.talent_documents;
create policy "Talent upload dokumen sendiri"
  on public.talent_documents for insert
  to authenticated
  with check (talent_id = public.my_talent_id());

drop policy if exists "Talent hapus dokumen sendiri" on public.talent_documents;
create policy "Talent hapus dokumen sendiri"
  on public.talent_documents for delete
  to authenticated
  using (talent_id = public.my_talent_id());

-- File dokumen: admin, atau talent ke folder <talent_id>/ miliknya sendiri
drop policy if exists "Admin upload dokumen" on storage.objects;
drop policy if exists "Upload dokumen" on storage.objects;
create policy "Upload dokumen"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'talent-documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_talent_id())
  );

-- ---------------------------------------------------------------------
-- 4. STATISTIK (angka harian per talent, tanpa data pribadi pengunjung)
-- ---------------------------------------------------------------------
create table if not exists public.talent_daily_stats (
  talent_id          text not null references public.talents (id) on delete cascade,
  day                date not null,
  profile_views      int not null default 0,
  live_sessions      int not null default 0,
  peak_live_viewers  int not null default 0,
  primary key (talent_id, day)
);

alter table public.talent_daily_stats enable row level security;
-- Tidak ada policy: hanya bisa dibaca lewat admin_stats() dan ditulis lewat fungsi di bawah.

create or replace function public.jakarta_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Dipanggil website saat pengunjung membuka profil talent
create or replace function public.record_talent_view(p_talent_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.talents where id = p_talent_id and is_active and id_verified_at is not null
  ) then
    return;
  end if;
  insert into public.talent_daily_stats (talent_id, day, profile_views)
  values (p_talent_id, public.jakarta_today(), 1)
  on conflict (talent_id, day) do update
    set profile_views = public.talent_daily_stats.profile_views + 1;
end;
$$;

grant execute on function public.record_talent_view(text) to anon, authenticated;

-- Dipanggil studio talent saat jumlah penonton naik
create or replace function public.record_live_viewers(p_talent_id text, p_viewers int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_broadcast(p_talent_id) then
    return;
  end if;
  insert into public.talent_daily_stats (talent_id, day, peak_live_viewers)
  values (p_talent_id, public.jakarta_today(), least(greatest(p_viewers, 0), 100000))
  on conflict (talent_id, day) do update
    set peak_live_viewers = greatest(public.talent_daily_stats.peak_live_viewers, excluded.peak_live_viewers);
end;
$$;

revoke execute on function public.record_live_viewers(text, int) from public, anon;
grant execute on function public.record_live_viewers(text, int) to authenticated;

-- set_talent_live versi baru: sama seperti sebelumnya + menghitung sesi live
create or replace function public.set_talent_live(
  p_talent_id   text,
  p_is_live     boolean,
  p_title       text default null,
  p_stream_type text default null,
  p_stream_url  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_live boolean;
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses untuk mengatur live talent ini.';
  end if;

  select is_live into v_was_live from public.talents where id = p_talent_id;

  update public.talents
  set is_live           = p_is_live,
      live_status_text  = case when p_is_live then 'Sedang Live Stream Sekarang' else 'Offline' end,
      live_stream_title = coalesce(p_title, live_stream_title),
      live_stream_type  = coalesce(p_stream_type, live_stream_type),
      live_stream_url   = coalesce(p_stream_url, live_stream_url),
      live_heartbeat_at = case when p_is_live then now() else null end
  where id = p_talent_id;

  if p_is_live and not coalesce(v_was_live, false) then
    insert into public.talent_daily_stats (talent_id, day, live_sessions)
    values (p_talent_id, public.jakarta_today(), 1)
    on conflict (talent_id, day) do update
      set live_sessions = public.talent_daily_stats.live_sessions + 1;
  end if;
end;
$$;

-- Ringkasan untuk tab "Statistik" di panel admin
create or replace function public.admin_stats(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_to   date := public.jakarta_today();
  v_from date := public.jakarta_today() - (least(greatest(p_days, 1), 365) - 1);
  v_from_ts timestamptz := (public.jakarta_today() - (least(greatest(p_days, 1), 365) - 1))::timestamp at time zone 'Asia/Jakarta';
begin
  if not public.is_admin() then
    raise exception 'Hanya admin.';
  end if;

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'totals', jsonb_build_object(
      'profile_views',     (select coalesce(sum(profile_views), 0) from public.talent_daily_stats where day >= v_from),
      'live_sessions',     (select coalesce(sum(live_sessions), 0) from public.talent_daily_stats where day >= v_from),
      'peak_live_viewers', (select coalesce(max(peak_live_viewers), 0) from public.talent_daily_stats where day >= v_from),
      'new_likes',         (select count(*) from public.likes where created_at >= v_from_ts),
      'new_reviews',       (select count(*) from public.reviews where created_at >= v_from_ts),
      'new_members',       (select count(*) from public.profiles where created_at >= v_from_ts and role = 'user')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'views', coalesce(s.views, 0)) order by d.day), '[]'::jsonb)
      from (select generate_series(v_from, v_to, interval '1 day')::date as day) d
      left join (
        select day, sum(profile_views) as views
        from public.talent_daily_stats where day >= v_from group by day
      ) s on s.day = d.day
    ),
    'talents', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.views desc, x.name), '[]'::jsonb)
      from (
        select t.id, t.name,
               t.likes_count as likes,
               t.rating_average as rating,
               t.reviews_count as reviews,
               (t.is_active and t.id_verified_at is not null) as visible,
               coalesce(sum(s.profile_views), 0) as views,
               coalesce(sum(s.live_sessions), 0) as live_sessions,
               coalesce(max(s.peak_live_viewers), 0) as peak_viewers
        from public.talents t
        left join public.talent_daily_stats s on s.talent_id = t.id and s.day >= v_from
        group by t.id
      ) x
    )
  );
end;
$$;

revoke execute on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. NOTIFIKASI TELEGRAM KE ADMIN
--    Database memanggil fungsi server "notify-admin" lewat pg_net (asinkron,
--    tidak memperlambat / menggagalkan aksi utama). Alamat & kunci rahasianya
--    diisi otomatis oleh `npm run functions:deploy` ke tabel private.app_config.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key   text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

create or replace function private.notify_admin(p_event text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.app_config where key = 'notify_url';
  select value into v_secret from private.app_config where key = 'notify_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('event', p_event, 'data', p_data),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    -- fungsi server bisa butuh beberapa detik untuk "bangun" setelah lama tidak dipakai
    timeout_milliseconds := 15000
  );
exception when others then
  raise warning 'notify_admin gagal: %', sqlerrm;
end;
$$;

revoke execute on function private.notify_admin(text, jsonb) from public, anon, authenticated;

-- 5a. Laporan baru
create or replace function private.notify_on_report()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.notify_admin('report', jsonb_build_object(
    'reason', new.reason,
    'target_type', new.target_type,
    'talent_id', new.talent_id,
    'talent_name', (select name from public.talents where id = new.talent_id),
    'details', left(new.details, 300)
  ));
  return null;
end;
$$;

drop trigger if exists notify_on_report on public.reports;
create trigger notify_on_report
  after insert on public.reports
  for each row execute function private.notify_on_report();

-- 5b. Talent mulai live
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
  end if;
  return null;
end;
$$;

drop trigger if exists notify_on_live_start on public.talents;
create trigger notify_on_live_start
  after update of is_live on public.talents
  for each row execute function private.notify_on_live_start();

-- 5c. Talent upload dokumen identitas (menunggu verifikasi admin)
create or replace function private.notify_on_document()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if public.is_admin() then
    return null; -- admin sendiri yang upload, tidak perlu diberi tahu
  end if;
  perform private.notify_admin('document_uploaded', jsonb_build_object(
    'talent_id', new.talent_id,
    'talent_name', (select name from public.talents where id = new.talent_id),
    'doc_type', new.doc_type
  ));
  return null;
end;
$$;

drop trigger if exists notify_on_document on public.talent_documents;
create trigger notify_on_document
  after insert on public.talent_documents
  for each row execute function private.notify_on_document();
