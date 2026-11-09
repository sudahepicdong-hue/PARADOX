// Deploy semua Edge Function ke Supabase + simpan kunci LiveKit sebagai secret server.
// Pemakaian:  npm run functions:deploy
// Butuh di .env:
//   VITE_SUPABASE_URL      (dipakai untuk mengambil project ref)
//   SUPABASE_ACCESS_TOKEN  (buat di https://supabase.com/dashboard/account/tokens)
//   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET  (dari https://cloud.livekit.io > Settings > Keys)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FUNCTIONS = ['admin-talent-account', 'livekit-token', 'delete-account'];

const url = process.env.VITE_SUPABASE_URL ?? '';
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];

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

// 1. Kunci LiveKit -> secret server (tidak pernah dikirim ke browser)
const secrets = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].filter((k) => process.env[k]);
if (secrets.length === 3) {
  console.log('\n> Menyimpan kunci LiveKit ke Supabase secrets...');
  // Lewat file sementara (bukan argumen command line) supaya tanda kutip / spasi tidak ikut tersimpan
  const dir = mkdtempSync(join(tmpdir(), 'paradox-secrets-'));
  const file = join(dir, 'livekit.env');
  let status = 1;
  try {
    writeFileSync(file, secrets.map((k) => `${k}=${process.env[k].trim()}`).join('\n') + '\n', { mode: 0o600 });
    status = supabase(['secrets', 'set', '--env-file', `"${file}"`]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (status !== 0) process.exit(status);
} else {
  console.warn('\n! LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET belum lengkap di .env — live streaming belum bisa dipakai.');
}

// 2. Deploy fungsi (pengecekan login dilakukan di dalam masing-masing fungsi)
for (const fn of FUNCTIONS) {
  console.log(`\n> Deploy ${fn}...`);
  supabaseOrExit(['functions', 'deploy', fn, '--no-verify-jwt', '--use-api']);
}

console.log('\nSelesai.');
