// Nyalakan / matikan verifikasi bukan bot (Cloudflare Turnstile) di Supabase Auth.
// Pakai:  npm run captcha:on   |   npm run captcha:off
// Butuh di .env: SUPABASE_ACCESS_TOKEN, VITE_SUPABASE_URL, TURNSTILE_SECRET_KEY (untuk "on")
const on = process.argv[2] !== 'off';
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN atau VITE_SUPABASE_URL belum diisi di .env.');
  process.exit(1);
}
if (on && !secret) {
  console.error('TURNSTILE_SECRET_KEY belum diisi di .env (Secret Key dari Cloudflare Turnstile).');
  process.exit(1);
}
if (on && !process.env.VITE_TURNSTILE_SITE_KEY?.trim()) {
  console.error('VITE_TURNSTILE_SITE_KEY belum diisi di .env. Isi juga di Sevalla & deploy dulu, baru nyalakan.');
  process.exit(1);
}

const body = on
  ? { security_captcha_enabled: true, security_captcha_provider: 'turnstile', security_captcha_secret: secret }
  : { security_captcha_enabled: false };

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
if (!res.ok) {
  console.error('Gagal:', res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}
const cfg = await res.json();
console.log(
  cfg.security_captcha_enabled
    ? `Verifikasi bukan bot AKTIF (${cfg.security_captcha_provider}). Login/daftar/lupa password sekarang wajib lolos Turnstile.`
    : 'Verifikasi bukan bot DIMATIKAN.'
);
