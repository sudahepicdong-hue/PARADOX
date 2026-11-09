-- =====================================================================
-- PARADOX - Live streaming sungguhan (heartbeat) & riwayat aktivitas admin
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LIVE: "detak jantung" supaya status live otomatis mati
--    kalau talent menutup browser tanpa menekan "Akhiri Live".
-- ---------------------------------------------------------------------
alter table public.talents add column if not exists live_heartbeat_at timestamptz;

-- Boleh siaran untuk talent ini? (admin, atau talent pemilik profil)
create or replace function public.can_broadcast(p_talent_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'talent' and talent_id = p_talent_id
      );
$$;

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
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses untuk mengatur live talent ini.';
  end if;

  update public.talents
  set is_live           = p_is_live,
      live_status_text  = case when p_is_live then 'Sedang Live Stream Sekarang' else 'Offline' end,
      live_stream_title = coalesce(p_title, live_stream_title),
      live_stream_type  = coalesce(p_stream_type, live_stream_type),
      live_stream_url   = coalesce(p_stream_url, live_stream_url),
      live_heartbeat_at = case when p_is_live then now() else null end
  where id = p_talent_id;
end;
$$;

-- Dipanggil browser talent setiap 30 detik selama siaran
create or replace function public.talent_live_heartbeat(p_talent_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_broadcast(p_talent_id) then
    raise exception 'Anda tidak punya akses.';
  end if;
  update public.talents set live_heartbeat_at = now() where id = p_talent_id and is_live;
end;
$$;

revoke execute on function public.can_broadcast(text) from public, anon;
grant execute on function public.can_broadcast(text) to authenticated;
revoke execute on function public.talent_live_heartbeat(text) from public, anon;
grant execute on function public.talent_live_heartbeat(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. RIWAYAT AKTIVITAS ADMIN
--    Diisi otomatis oleh database (trigger), jadi tidak bisa dipalsukan dari website.
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references auth.users (id) on delete set null,
  actor_name    text not null default '',
  action        text not null,
  target_type   text not null,
  target_id     text,
  target_label  text,
  details       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admin baca riwayat" on public.admin_audit_log;
create policy "Admin baca riwayat"
  on public.admin_audit_log for select
  to authenticated
  using (public.is_admin());

grant select on public.admin_audit_log to authenticated;

create or replace function public.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_label text,
  p_details jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
  values (
    auth.uid(),
    coalesce((select coalesce(nullif(name, ''), email) from public.profiles where id = auth.uid()), 'sistem'),
    p_action, p_target_type, p_target_id, p_label, coalesce(p_details, '{}')
  );
end;
$$;

-- Hanya boleh dipanggil dari dalam trigger, bukan dari website
revoke execute on function public.write_audit(text, text, text, text, jsonb) from public, anon, authenticated;

-- 2a. Talent
create or replace function public.audit_talents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed text[];
  ignored text[] := array[
    'updated_at', 'is_live', 'live_status_text', 'live_stream_title', 'live_stream_type',
    'live_stream_url', 'live_viewers_count', 'live_heartbeat_at',
    'likes_count', 'rating_average', 'reviews_count'
  ];
begin
  -- Perubahan dari sistem (setup script / fungsi server) tidak dicatat di sini
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.write_audit('talent.create', 'talent', new.id, new.name);
  elsif tg_op = 'DELETE' then
    perform public.write_audit(
      case when public.is_admin() then 'talent.delete' else 'talent.self_delete' end,
      'talent', old.id, old.name
    );
  else
    select array_agg(n.key) into changed
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key)
      and not (n.key = any (ignored));

    if changed is null then
      return null;
    end if;

    if 'id_verified_at' = any (changed) then
      perform public.write_audit(
        case when new.id_verified_at is null then 'talent.unverify' else 'talent.verify' end,
        'talent', new.id, new.name,
        case when new.id_verified_at is null then '{}'::jsonb else jsonb_build_object('age', new.age) end
      );
      changed := array_remove(array_remove(array_remove(changed, 'id_verified_at'), 'verified'), 'age');
    end if;

    if 'is_active' = any (changed) then
      perform public.write_audit(
        case when new.is_active then 'talent.show' else 'talent.hide' end,
        'talent', new.id, new.name,
        jsonb_build_object('by', case when public.is_admin() then 'admin' else 'talent' end)
      );
      changed := array_remove(changed, 'is_active');
    end if;

    if coalesce(array_length(changed, 1), 0) > 0 then
      perform public.write_audit(
        case when public.is_admin() then 'talent.update' else 'talent.self_update' end,
        'talent', new.id, new.name, jsonb_build_object('fields', changed)
      );
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_talents on public.talents;
create trigger audit_talents
  after insert or update or delete on public.talents
  for each row execute function public.audit_talents();

-- 2b. Dokumen identitas
create or replace function public.audit_talent_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id text := coalesce(new.talent_id, old.talent_id);
  t_name text := (select name from public.talents where id = coalesce(new.talent_id, old.talent_id));
begin
  if auth.uid() is null then
    return null;
  end if;
  perform public.write_audit(
    case when tg_op = 'INSERT' then 'document.upload' else 'document.delete' end,
    'talent', t_id, t_name,
    jsonb_build_object('doc_type', coalesce(new.doc_type, old.doc_type))
  );
  return null;
end;
$$;

drop trigger if exists audit_talent_documents on public.talent_documents;
create trigger audit_talent_documents
  after insert or delete on public.talent_documents
  for each row execute function public.audit_talent_documents();

-- 2c. Ulasan dihapus admin (bukan oleh penulisnya sendiri)
create or replace function public.audit_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or old.user_id = auth.uid() or not public.is_admin() then
    return null;
  end if;
  perform public.write_audit(
    'review.delete', 'review', old.id::text, old.user_name,
    jsonb_build_object('talent_id', old.talent_id, 'rating', old.rating, 'comment', left(old.comment, 200))
  );
  return null;
end;
$$;

drop trigger if exists audit_reviews on public.reviews;
create trigger audit_reviews
  after delete on public.reviews
  for each row execute function public.audit_reviews();

-- 2d. Laporan ditangani
create or replace function public.audit_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.status is not distinct from old.status then
    return null;
  end if;
  perform public.write_audit(
    'report.' || new.status, 'report', new.id::text, new.reason,
    jsonb_build_object('talent_id', new.talent_id, 'review_id', new.review_id)
  );
  return null;
end;
$$;

drop trigger if exists audit_reports on public.reports;
create trigger audit_reports
  after update on public.reports
  for each row execute function public.audit_reports();

-- 2e. Pengaturan website
create or replace function public.audit_site_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  perform public.write_audit('settings.update', 'settings', '1', 'Pengaturan website');
  return null;
end;
$$;

drop trigger if exists audit_site_settings on public.site_settings;
create trigger audit_site_settings
  after update on public.site_settings
  for each row execute function public.audit_site_settings();
