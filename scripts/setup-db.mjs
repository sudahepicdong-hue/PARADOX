// Menjalankan semua file .sql di supabase/migrations ke database Supabase.
// Pemakaian:  npm run db:setup
// Butuh SUPABASE_DB_URL di file .env (Supabase > Project Settings > Database > Connection string > URI).
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL belum diisi di file .env');
  process.exit(1);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

const sql = postgres(dbUrl, { ssl: 'require', max: 1, onnotice: () => {} });

try {
  for (const file of files) {
    process.stdout.write(`Menjalankan ${file} ... `);
    const text = await readFile(join(migrationsDir, file), 'utf8');
    await sql.unsafe(text);
    console.log('OK');
  }
  console.log('Selesai. Tabel sudah dibuat di Supabase.');
} catch (err) {
  console.log('GAGAL');
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
