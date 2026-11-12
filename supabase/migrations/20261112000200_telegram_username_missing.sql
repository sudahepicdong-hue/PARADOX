-- =====================================================================
-- PARADOX - Deteksi talent yang menghapus username Telegram.
-- Tombol "Chat Telegram" di website memakai username; kalau dihapus, link mati
-- dan username lama bisa diambil orang lain. Bot menandai waktunya di sini,
-- memaksa Offline, dan menolak /online sampai username dipasang lagi.
-- Aman dijalankan berulang kali (idempotent).
-- =====================================================================

alter table public.talent_telegram_links
  add column if not exists username_missing_since timestamptz;
