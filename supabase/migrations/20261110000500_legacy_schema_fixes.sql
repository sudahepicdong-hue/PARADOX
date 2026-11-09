-- =====================================================================
-- PARADOX - Penyesuaian untuk database yang sudah punya tabel dari versi lama.
-- Di database baru, file ini tidak mengubah apa-apa. Aman dijalankan berulang kali.
-- =====================================================================

-- 1. talents versi lama tidak punya kolom media (foto/video)
alter table public.talents add column if not exists media jsonb not null default '[]';

-- talents versi lama mewajibkan jumlah penonton terisi; sekarang boleh kosong
alter table public.talents alter column live_viewers_count drop not null;

-- 2. site_settings versi lama menyimpan pengaturan per kolom (brand_name, logo_url, ...).
--    Versi sekarang memakai satu kolom JSON "data" + updated_at.
alter table public.site_settings add column if not exists data jsonb not null default '{}';
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

do $$
begin
  -- Pastikan ada baris dengan id = 1 (yang dibaca website)
  if not exists (select 1 from public.site_settings where id = 1) then
    if exists (select 1 from public.site_settings) then
      update public.site_settings set id = 1 where id = (select min(id) from public.site_settings);
    else
      insert into public.site_settings (id) values (1);
    end if;
  end if;

  -- Pindahkan nilai lama yang TIDAK kosong ke kolom data (sekali saja, kalau data masih kosong)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'brand_name'
  ) then
    execute $sql$
      update public.site_settings
      set data = jsonb_strip_nulls(jsonb_build_object(
        'brandName',                nullif(brand_name, ''),
        'brandTagline',             nullif(brand_tagline, ''),
        'logoUrl',                  nullif(logo_url, ''),
        'officialTelegramUsername', nullif(official_telegram_username, ''),
        'officialTelegramUrl',      nullif(official_telegram_url, ''),
        'heroHeadline',             nullif(hero_headline, ''),
        'heroSubtitle',             nullif(hero_subtitle, ''),
        'heroAnnouncement',         nullif(hero_announcement, ''),
        'accentStyle',              nullif(accent_style, ''),
        'disclaimerText',           nullif(disclaimer_text, ''),
        'supportHeading',           nullif(support_heading, ''),
        'supportSubtext',           nullif(support_subtext, '')
      ))
      where id = 1 and data = '{}'::jsonb
    $sql$;
  end if;
end;
$$;

-- 3. Trigger lama yang menyalin akun baru ke tabel user_accounts (tidak dipakai lagi).
--    Dimatikan supaya tidak bisa menggagalkan pendaftaran. Tabel user_accounts TIDAK dihapus.
drop trigger if exists on_auth_user_created_account on auth.users;
