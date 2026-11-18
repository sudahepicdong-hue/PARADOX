-- Username Telegram di profil website SELALU mengikuti akun Telegram yang terhubung ke bot absen
-- (saat pertama terhubung, disetujui admin, maupun saat talent ganti username).
-- Kalau username dihapus (null), profil tidak diubah: bot yang menangani (status Offline + kabari admin).
create or replace function private.sync_profile_telegram_username()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.telegram_username is not null and new.telegram_username <> '' then
    update public.talents
       set telegram_username = new.telegram_username
     where id = new.talent_id
       and lower(coalesce(telegram_username, '')) is distinct from lower(new.telegram_username);
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_profile_telegram_username() from public, anon, authenticated;

drop trigger if exists talent_links_sync_profile_username on public.talent_telegram_links;
create trigger talent_links_sync_profile_username
  after insert or update of telegram_username on public.talent_telegram_links
  for each row execute function private.sync_profile_telegram_username();

-- Rapikan profil yang sudah terlanjur beda dengan akun Telegram terhubungnya
update public.talents t
   set telegram_username = l.telegram_username
  from public.talent_telegram_links l
 where l.talent_id = t.id
   and l.telegram_username is not null and l.telegram_username <> ''
   and lower(coalesce(t.telegram_username, '')) <> lower(l.telegram_username);
