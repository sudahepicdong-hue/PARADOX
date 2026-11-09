-- =====================================================================
-- PARADOX - Talent, ulasan, like, pengaturan website, dan upload media
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: apakah user yang sedang login adalah admin?
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 1. TALENTS
-- ---------------------------------------------------------------------
create table if not exists public.talents (
  id                  text primary key,
  name                text not null,
  alias               text not null default '',
  city                text,
  age                 int,
  height              int,
  weight              int,
  bra_size            text,
  is_live             boolean not null default false,
  live_status_text    text,
  telegram_username   text not null,
  telegram_phone      text,
  bio                 text not null default '',
  zodiac              text not null default '',
  languages           text[] not null default '{}',
  services            text[] not null default '{}',
  rates               jsonb not null default '{}',
  media               jsonb not null default '[]',
  -- 3 kolom ini dihitung otomatis oleh database dari tabel likes & reviews
  likes_count         int not null default 0,
  rating_average      numeric(3, 2) not null default 0,
  reviews_count       int not null default 0,
  verified            boolean not null default false,
  featured            boolean not null default false,
  live_stream_title   text,
  live_stream_type    text,
  live_stream_url     text,
  live_viewers_count  int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists talents_touch_updated_at on public.talents;
create trigger talents_touch_updated_at
  before update on public.talents
  for each row execute function public.touch_updated_at();

alter table public.talents enable row level security;

drop policy if exists "Semua orang bisa lihat talent" on public.talents;
create policy "Semua orang bisa lihat talent"
  on public.talents for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin bisa tambah talent" on public.talents;
create policy "Admin bisa tambah talent"
  on public.talents for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin bisa ubah talent" on public.talents;
create policy "Admin bisa ubah talent"
  on public.talents for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin bisa hapus talent" on public.talents;
create policy "Admin bisa hapus talent"
  on public.talents for delete
  to authenticated
  using (public.is_admin());

-- Talent boleh menyalakan/mematikan live untuk profilnya sendiri (admin untuk semua talent).
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
  if not (
    public.is_admin()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'talent' and talent_id = p_talent_id
    )
  ) then
    raise exception 'Anda tidak punya akses untuk mengatur live talent ini.';
  end if;

  update public.talents
  set is_live           = p_is_live,
      live_status_text  = case when p_is_live then 'Sedang Live Stream Sekarang' else 'Offline' end,
      live_stream_title = coalesce(p_title, live_stream_title),
      live_stream_type  = coalesce(p_stream_type, live_stream_type),
      live_stream_url   = coalesce(p_stream_url, live_stream_url)
  where id = p_talent_id;
end;
$$;

revoke execute on function public.set_talent_live(text, boolean, text, text, text) from public, anon;
grant execute on function public.set_talent_live(text, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. REVIEWS (1 ulasan per akun per talent)
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  talent_id   text not null references public.talents (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_name   text not null default '',
  rating      int not null check (rating between 1 and 5),
  comment     text not null check (char_length(comment) between 1 and 2000),
  created_at  timestamptz not null default now(),
  unique (talent_id, user_id)
);

create index if not exists reviews_talent_id_idx on public.reviews (talent_id);

-- Nama penulis selalu diambil dari profil, jadi tidak bisa dipalsukan.
create or replace function public.reviews_set_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_name := coalesce(
    (select nullif(p.name, '') from public.profiles p where p.id = new.user_id),
    'Member'
  );
  if tg_op = 'UPDATE' then new.created_at := now(); end if;
  return new;
end;
$$;

drop trigger if exists reviews_set_author on public.reviews;
create trigger reviews_set_author
  before insert or update on public.reviews
  for each row execute function public.reviews_set_author();

-- Hitung ulang rating rata-rata & jumlah ulasan talent setiap ada perubahan.
create or replace function public.reviews_refresh_talent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id text := coalesce(new.talent_id, old.talent_id);
begin
  update public.talents t
  set rating_average = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.talent_id = t_id), 0),
      reviews_count  = (select count(*) from public.reviews r where r.talent_id = t_id)
  where t.id = t_id;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_talent on public.reviews;
create trigger reviews_refresh_talent
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_refresh_talent();

alter table public.reviews enable row level security;

drop policy if exists "Semua orang bisa baca ulasan" on public.reviews;
create policy "Semua orang bisa baca ulasan"
  on public.reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "Member bisa tulis ulasan sendiri" on public.reviews;
create policy "Member bisa tulis ulasan sendiri"
  on public.reviews for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Member bisa ubah ulasan sendiri" on public.reviews;
create policy "Member bisa ubah ulasan sendiri"
  on public.reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Member/admin bisa hapus ulasan" on public.reviews;
create policy "Member/admin bisa hapus ulasan"
  on public.reviews for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 3. LIKES (1 like per akun per talent)
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  talent_id   text not null references public.talents (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, talent_id)
);

create or replace function public.likes_refresh_talent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id text := coalesce(new.talent_id, old.talent_id);
begin
  update public.talents
  set likes_count = (select count(*) from public.likes l where l.talent_id = t_id)
  where id = t_id;
  return null;
end;
$$;

drop trigger if exists likes_refresh_talent on public.likes;
create trigger likes_refresh_talent
  after insert or delete on public.likes
  for each row execute function public.likes_refresh_talent();

alter table public.likes enable row level security;

drop policy if exists "Member lihat like sendiri" on public.likes;
create policy "Member lihat like sendiri"
  on public.likes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Member tambah like sendiri" on public.likes;
create policy "Member tambah like sendiri"
  on public.likes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Member hapus like sendiri" on public.likes;
create policy "Member hapus like sendiri"
  on public.likes for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. SITE SETTINGS (hanya 1 baris, id = 1)
-- Kolom yang kosong otomatis memakai DEFAULT_SITE_SETTINGS di kode website.
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id          int primary key default 1 check (id = 1),
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "Semua orang bisa baca pengaturan" on public.site_settings;
create policy "Semua orang bisa baca pengaturan"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin bisa ubah pengaturan" on public.site_settings;
create policy "Admin bisa ubah pengaturan"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Izin akses tabel (aturan detailnya tetap dijaga oleh policy RLS di atas)
grant select on public.talents, public.reviews, public.site_settings to anon, authenticated;
grant insert, update, delete on public.talents to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant update on public.site_settings to authenticated;

-- ---------------------------------------------------------------------
-- 5. STORAGE: bucket untuk upload foto & video talent (maks 50 MB per file)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('talent-media', 'talent-media', true, 52428800, array['image/*', 'video/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin upload talent-media" on storage.objects;
create policy "Admin upload talent-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'talent-media' and public.is_admin());

drop policy if exists "Admin ubah talent-media" on storage.objects;
create policy "Admin ubah talent-media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'talent-media' and public.is_admin());

drop policy if exists "Admin hapus talent-media" on storage.objects;
create policy "Admin hapus talent-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'talent-media' and public.is_admin());

-- ---------------------------------------------------------------------
-- 6. DATA AWAL: hanya diisi saat pertama kali (saat baris site_settings belum ada).
-- Kalau admin nanti menghapus talent contoh, menjalankan ulang script tidak akan memunculkannya lagi.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.site_settings where id = 1) then
    return;
  end if;

  insert into public.site_settings (id, data) values (1, '{}');

  insert into public.talents (
    id, name, alias, city, age, height, weight, bra_size, is_live, live_status_text,
    telegram_username, telegram_phone, bio, zodiac, languages, services, rates, media, verified, featured
  ) values
  (
    'talent-1', 'Valerie Anastasya', 'Valerie Queen', 'Jakarta', 23, 168, 49, '34C', false, 'Offline',
    'valerie_paradox_vip', '+6281234567890',
    'Model runway dan high-fashion enthusiast. Berpengalaman menemani jamuan VIP dinner formal, rooftop party, maupun private photoshoot elegan.',
    'Scorpio', array['Indonesia', 'English (Fluent)'],
    array['VIP Dinner Companion', 'Private Party Host', 'Photoshoot Model', 'Nightclub Table Mate'],
    '{"dinnerDate": "Rp 2.500.000 / 3 Jam", "vipParty": "Rp 4.500.000 / Malam", "photoshoot": "Rp 1.800.000 / Sesi"}',
    '[{"id": "val-1", "type": "image", "url": "/images/talent_model_valerie_1794207018750.jpg", "title": "Emerald Gown Portrait"},
      {"id": "val-vid-1", "type": "video", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "thumbnail": "/images/talent_model_valerie_1794207018750.jpg", "title": "VIP Lounge Video Greeting"},
      {"id": "val-2", "type": "image", "url": "/images/talent_model_amanda_1794207019628.jpg", "title": "Glamour Cocktail Look"}]',
    true, true
  ),
  (
    'talent-2', 'Amanda Chyntia', 'Manda Velvet', 'Bali', 22, 165, 48, '34B', false, 'Offline',
    'amanda_paradox_vip', '+6281298765432',
    'Ramah, supel, dan selalu membawa energi ceria. Siap mendampingi liburan santai di beach club Bali, sunset yacht cruise, hingga private clubbing.',
    'Leo', array['Indonesia', 'English', 'Mandarin Basic'],
    array['Beach Club Companion', 'Yacht Trip Mate', 'Dinner Date', 'Clubbing Buddy'],
    '{"dinnerDate": "Rp 2.800.000 / 3 Jam", "vipParty": "Rp 5.000.000 / Malam", "photoshoot": "Rp 2.000.000 / Sesi"}',
    '[{"id": "manda-1", "type": "image", "url": "/images/talent_model_amanda_1794207019628.jpg", "title": "Velvet Green Club Look"},
      {"id": "manda-vid-1", "type": "video", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", "thumbnail": "/images/talent_model_amanda_1794207019628.jpg", "title": "Video Teaser Bali Trip"},
      {"id": "manda-2", "type": "image", "url": "/images/talent_model_giselle_1794207019101.jpg", "title": "Night Glow Outfit"}]',
    true, true
  ),
  (
    'talent-3', 'Giselle Clarissa', 'Giselle Noir', 'Surabaya', 24, 171, 52, '36C', false, 'Offline',
    'giselle_paradox_vip', '+6281311223344',
    'Tinggi proporsional dengan aura elegan mewah. Sangat mahir dalam obrolan bisnis, wine tasting, serta mendampingi acara eksklusif kelas atas.',
    'Libra', array['Indonesia', 'English'],
    array['Executive Business Dinner', 'Gala Night Escort', 'Cocktail Lounge Host', 'VIP Meetup'],
    '{"dinnerDate": "Rp 3.000.000 / 3 Jam", "vipParty": "Rp 5.500.000 / Malam", "photoshoot": "Rp 2.200.000 / Sesi"}',
    '[{"id": "gis-1", "type": "image", "url": "/images/talent_model_giselle_1794207019101.jpg", "title": "Black Sequin Glamour"},
      {"id": "gis-vid-1", "type": "video", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", "thumbnail": "/images/talent_model_giselle_1794207019101.jpg", "title": "Behind The Scenes Clip"},
      {"id": "gis-2", "type": "image", "url": "/images/talent_model_valerie_1794207018750.jpg", "title": "Gala Night Dress"}]',
    true, false
  ),
  (
    'talent-4', 'Natasha Kimberly', 'Natasha Sweet', 'Bandung', 21, 162, 46, '32B', false, 'Offline',
    'natasha_paradox_vip', '+6281722334455',
    'Cute, manis, dan berwajah oriental. Sangat cocok untuk cafe hopping santai, karaoke private room, dan nonton film bersama.',
    'Gemini', array['Indonesia', 'Sunda', 'English'],
    array['Private Cafe Hopping', 'Karaoke Partner', 'Movie Date Companion', 'Weekend Trip'],
    '{"dinnerDate": "Rp 2.000.000 / 3 Jam", "vipParty": "Rp 3.800.000 / Malam", "photoshoot": "Rp 1.500.000 / Sesi"}',
    '[{"id": "nat-1", "type": "image", "url": "/images/talent_model_amanda_1794207019628.jpg", "title": "Sweet Velvet Glam"},
      {"id": "nat-vid-1", "type": "video", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "thumbnail": "/images/talent_model_amanda_1794207019628.jpg", "title": "Bandung Chill Greeting"},
      {"id": "nat-2", "type": "image", "url": "/images/talent_model_giselle_1794207019101.jpg", "title": "Casual Chic Night"}]',
    true, true
  ),
  (
    'talent-5', 'Chelsea Caroline', 'Chelsea Chic', 'Jakarta', 25, 169, 51, '36D', false, 'Offline',
    'chelsea_paradox_vip', '+6281899887766',
    'Model bervolume elegan dengan postur menawan. Berkelas, sopan, dan mengerti tata krama VIP lounge maupun high-society dining.',
    'Taurus', array['Indonesia', 'English'],
    array['VIP Clubbing Host', 'Luxury Yachting', 'Private Meetup', 'Nightlife Guide'],
    '{"dinnerDate": "Rp 3.200.000 / 3 Jam", "vipParty": "Rp 6.000.000 / Malam", "photoshoot": "Rp 2.500.000 / Sesi"}',
    '[{"id": "che-1", "type": "image", "url": "/images/talent_model_valerie_1794207018750.jpg", "title": "VIP Lounge Exclusive"},
      {"id": "che-2", "type": "image", "url": "/images/talent_model_amanda_1794207019628.jpg", "title": "Golden Glow Evening"}]',
    true, false
  ),
  (
    'talent-6', 'Stefanie Angelina', 'Stefi Gold', 'Bali', 23, 167, 50, '34C', false, 'Offline',
    'stefanie_canggu_vip', '+6281988776655',
    'Eksotis, enerjik, dan hobi musik elektronik / DJ. Selalu jadi pusat perhatian di setiap pesta pantai dan festival musik.',
    'Aries', array['Indonesia', 'English Fluent'],
    array['Beach Club VIP Host', 'Music Festival Mate', 'Luxury Dining', 'After Party Guide'],
    '{"dinnerDate": "Rp 2.700.000 / 3 Jam", "vipParty": "Rp 4.800.000 / Malam", "photoshoot": "Rp 1.900.000 / Sesi"}',
    '[{"id": "ste-1", "type": "image", "url": "/images/talent_model_giselle_1794207019101.jpg", "title": "Shimmering Night Look"},
      {"id": "ste-vid-1", "type": "video", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", "thumbnail": "/images/talent_model_giselle_1794207019101.jpg", "title": "Canggu Sunset Party Clip"},
      {"id": "ste-2", "type": "image", "url": "/images/talent_model_valerie_1794207018750.jpg", "title": "Cocktail Gala Elegance"}]',
    true, true
  )
  on conflict (id) do nothing;
end;
$$;
