// Buka file backup dari GitHub Actions (paradox-backup-YYYY-MM-DD.tar.gz.enc, atau .zip hasil download GitHub).
// Pemakaian: npm run backup:open -- "C:\Users\...\Downloads\paradox-backup-2026-11-12.tar.gz.enc.zip"
// Password diambil dari BACKUP_PASSWORD di .env. Hasilnya diekstrak ke folder di sebelah file backup.
// Format sama dengan: openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// tar bawaan Windows (bisa .zip juga); tar Git Bash salah membaca "C:" sebagai alamat server
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

const file = process.argv[2];
const pass = process.env.BACKUP_PASSWORD;
if (!file || !fs.existsSync(file)) {
  console.error('File backup tidak ditemukan. Contoh: npm run backup:open -- "C:\\Users\\User\\Downloads\\paradox-backup-2026-11-12.tar.gz.enc.zip"');
  process.exit(1);
}
if (!pass) {
  console.error('BACKUP_PASSWORD belum ada di .env');
  process.exit(1);
}

// GitHub membungkus artifact dalam .zip; kalau yang diberikan .zip, ekstrak dulu
let enc = file;
if (file.toLowerCase().endsWith('.zip')) {
  const dir = path.dirname(path.resolve(file));
  const listed = execFileSync(TAR, ['-tf', file], { encoding: 'utf8' })
    .split('\n')
    .map((f) => f.trim())
    .find((f) => f.endsWith('.enc'));
  if (!listed) {
    console.error('Di dalam .zip tidak ada file backup .enc');
    process.exit(1);
  }
  execFileSync(TAR, ['-xf', file, '-C', dir]);
  enc = path.join(dir, listed);
}

const buf = fs.readFileSync(enc);
if (buf.subarray(0, 8).toString('latin1') !== 'Salted__') {
  console.error('Ini bukan file backup PARADOX yang valid.');
  process.exit(1);
}
const salt = buf.subarray(8, 16);
const keyIv = crypto.pbkdf2Sync(pass, salt, 200000, 48, 'sha256');
const decipher = crypto.createDecipheriv('aes-256-cbc', keyIv.subarray(0, 32), keyIv.subarray(32));
let plain;
try {
  plain = Buffer.concat([decipher.update(buf.subarray(16)), decipher.final()]);
} catch {
  console.error('Password salah atau file rusak.');
  process.exit(1);
}

const outDir = enc.replace(/\.tar\.gz\.enc$/, '');
fs.mkdirSync(outDir, { recursive: true });
const tgz = outDir + '.tar.gz';
fs.writeFileSync(tgz, plain);
execFileSync(TAR, ['-xzf', tgz, '-C', outDir]);
fs.unlinkSync(tgz);
console.log('Backup dibuka di:', path.resolve(outDir));
