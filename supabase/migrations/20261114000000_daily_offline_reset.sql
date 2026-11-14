-- Reset harian: setiap jam 07.00 WIB (00.00 UTC) semua talent dibuat Offline,
-- termasuk yang di-set "online terus" oleh admin. Talent harus absen /online lagi.
-- Setelah itu bot absen mengirim pengingat ke semua talent yang terhubung.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.daily_offline_reset()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.talents set online_until = null where online_until is not null;
  perform private.talent_bot_push('daily_reset', '{}'::jsonb);
end;
$$;

revoke execute on function private.daily_offline_reset() from public, anon, authenticated;

-- cron.schedule dengan nama yang sama akan memperbarui jadwal lama (aman dijalankan ulang)
select cron.schedule('paradox-daily-offline-reset', '0 0 * * *', $$select private.daily_offline_reset()$$);
