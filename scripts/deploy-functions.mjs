// Deploy semua Edge Function ke Supabase + simpan kunci-kunci sebagai secret server.
// Pemakaian:  npm run functions:deploy
// Butuh di .env:
//   VITE_SUPABASE_URL      (dipakai untuk mengambil project ref)
//   SUPABASE_ACCESS_TOKEN  (buat di https://supabase.com/dashboard/account/tokens)
//   SUPABASE_DB_URL        (untuk menyambungkan notifikasi database -> fungsi notify-admin)
//   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET  (live streaming)
// Opsional:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID  (notifikasi Telegram ke admin)
//   PUBLIC_SITE_URL                             (link website di pesan Telegram)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

const FUNCTIONS = ['admin-talent-account', 'livekit-token', 'delete-account', 'live-moderate', 'notify-admin'];
const SECRET_KEYS = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_ADMIN_CHAT_ID',
  'PUBLIC_SITE_URL',
];

const url = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i)?.[1];

if (!ref) {
  console.error('VITE_SUPABASE_URL di .env belum benar (contoh: https://abcd1234.supabase.co).');
  process.exit(1);
}
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN belum diisi di .env. Buat di https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const supabase = (args) => {
  // --yes: menjalankan script ini sudah berarti setuju untuk deploy ke project ini
  const r = spawnSync('npx', ['--yes', 'supabase@latest', ...args, '--project-ref', ref, '--yes'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  return r.status ?? 1;
};

const supabaseOrExit = (args) => {
  const status = supabase(args);
  if (status !== 0) process.exit(status);
};

const has = (k) => Boolean(process.env[k]?.trim());
if (!['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].every(has)) {
  console.warn('\n! Kunci LIVEKIT_* belum lengkap di .env — live streaming belum bisa dipakai.');
}
if (!has('TELEGRAM_BOT_TOKEN') || !has('TELEGRAM_ADMIN_CHAT_ID')) {
  console.warn('! TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID belum diisi — notifikasi Telegram dimatikan.');
}

// 1. Simpan kunci ke Supabase secrets (tidak pernah dikirim ke browser).
//    NOTIFY_WEBHOOK_SECRET dibuat acak setiap deploy: kunci antara database dan fungsi notify-admin.
const notifySecret = randomBytes(24).toString('hex');
const secretLines = SECRET_KEYS.filter(has).map((k) => `${k}=${process.env[k].trim()}`);
secretLines.push(`NOTIFY_WEBHOOK_SECRET=${notifySecret}`);

console.log('\n> Menyimpan kunci ke Supabase secrets...');
// Lewat file sementara (bukan argumen command line) supaya tanda kutip / spasi tidak ikut tersimpan
const dir = mkdtempSync(join(tmpdir(), 'paradox-secrets-'));
let status = 1;
try {
  const file = join(dir, 'secrets.env');
  writeFileSync(file, secretLines.join('\n') + '\n', { mode: 0o600 });
  status = supabase(['secrets', 'set', '--env-file', `"${file}"`]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (status !== 0) process.exit(status);

// 2. Beri tahu database ke mana & dengan kunci apa notifikasi dikirim
if (process.env.SUPABASE_DB_URL) {
  console.log('\n> Menyambungkan notifikasi database ke fungsi notify-admin...');
  const sql = postgres(process.env.SUPABASE_DB_URL, { ssl: 'require', max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into private.app_config (key, value) values
        ('notify_url', ${`${url}/functions/v1/notify-admin`}),
        ('notify_secret', ${notifySecret})
      on conflict (key) do update set value = excluded.value`;
  } catch (e) {
    console.warn(`! Gagal menyimpan konfigurasi notifikasi (jalankan npm run db:setup dulu?): ${e.message}`);
  } finally {
    await sql.end();
  }
} else {
  console.warn('! SUPABASE_DB_URL belum diisi — notifikasi Telegram tidak tersambung.');
}

// 3. Deploy fungsi (pengecekan login dilakukan di dalam masing-masing fungsi)
for (const fn of FUNCTIONS) {
  console.log(`\n> Deploy ${fn}...`);
  supabaseOrExit(['functions', 'deploy', fn, '--no-verify-jwt', '--use-api']);
}

console.log('\nSelesai.');
