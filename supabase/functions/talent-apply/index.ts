// Edge Function: formulir "Daftar Jadi Talent" dari website (boleh tanpa login).
// Pemeriksaan di server (tidak bisa diakali dari browser):
//   - verifikasi Cloudflare Turnstile (bukan bot)
//   - umur minimal 18 tahun dari tanggal lahir
//   - 2-5 foto JPG/PNG/WebP asli, maks 5 MB per foto
//   - batas spam: maks 3 pendaftaran per 24 jam dari jaringan yang sama,
//     dan 1 pendaftaran aktif per username Telegram
// Foto disimpan di bucket PRIVAT talent-applications (hanya admin yang bisa lihat).
// Secrets: TURNSTILE_SECRET_KEY, NOTIFY_WEBHOOK_SECRET (untuk acak alamat IP)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (error: string, status = 400) => json({ error }, status);

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PER_IP_PER_DAY = 3;

// Kenali jenis gambar dari isi file (bukan dari nama/tipe yang dikirim browser)
function sniffImage(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

// Umur menurut tanggal hari ini di WIB
function ageOn(birth: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date(Date.now() + 7 * 3600_000); // WIB
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age--;
  return age;
}

const cleanText = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!turnstileSecret) return fail('Pendaftaran belum diaktifkan di server.', 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('Data formulir tidak terbaca. Coba lagi.');
  }

  // 1. Verifikasi bukan bot
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const captcha = String(form.get('captchaToken') ?? '');
  if (!captcha) return fail('Centang dulu kotak verifikasi "bukan robot".');
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: turnstileSecret, response: captcha, ...(ip ? { remoteip: ip } : {}) }),
  })
    .then((r) => r.json())
    .catch(() => ({ success: false }));
  if (!verify.success) return fail('Verifikasi "bukan robot" gagal atau kedaluwarsa. Centang ulang lalu kirim lagi.');

  // 2. Periksa isian
  const name = cleanText(form.get('name'), 60);
  const birthDate = cleanText(form.get('birthDate'), 10);
  const city = cleanText(form.get('city'), 60);
  const about = cleanText(form.get('about'), 1000);
  const telegram = cleanText(form.get('telegram'), 100)
    .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');

  if (name.length < 2) return fail('Nama wajib diisi.');
  if (!/^[A-Za-z0-9_]{5,32}$/.test(telegram)) {
    return fail('Username Telegram tidak valid. Contoh: @namakamu (5-32 huruf, angka, atau garis bawah).');
  }
  const age = ageOn(birthDate);
  if (age === null) return fail('Tanggal lahir tidak valid.');
  if (age < 18) return fail('Maaf, pendaftaran hanya untuk usia 18 tahun ke atas.');
  if (age > 60) return fail('Tanggal lahir tidak valid.');
  if (form.get('consent') !== 'yes') return fail('Centang pernyataan persetujuan terlebih dahulu.');

  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < MIN_PHOTOS) return fail(`Upload minimal ${MIN_PHOTOS} foto.`);
  if (files.length > MAX_PHOTOS) return fail(`Maksimal ${MAX_PHOTOS} foto.`);
  const photos: { bytes: Uint8Array; ext: string; type: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_PHOTO_BYTES) return fail('Ukuran setiap foto maksimal 5 MB.');
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return fail('Foto harus berformat JPG, PNG, atau WebP.');
    photos.push({ bytes, ...kind });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Batas spam
  const ipHash = ip ? await sha256(`${Deno.env.get('NOTIFY_WEBHOOK_SECRET') ?? ''}:${ip}`) : null;
  if (ipHash) {
    const { count } = await db
      .from('talent_applications')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((count ?? 0) >= MAX_PER_IP_PER_DAY) {
      return fail('Terlalu banyak pendaftaran dari jaringan ini. Coba lagi besok.', 429);
    }
  }
  const { data: existing } = await db
    .from('talent_applications')
    .select('id')
    .ilike('telegram_username', telegram.replace(/_/g, '\\_'))
    .in('status', ['baru', 'dihubungi'])
    .limit(1);
  if (existing?.length) {
    return fail(`Pendaftaran untuk @${telegram} sudah kami terima. Admin akan menghubungi lewat Telegram, mohon ditunggu.`, 409);
  }

  // 4. Simpan foto lalu data
  const id = crypto.randomUUID();
  const paths: string[] = [];
  for (const [i, p] of photos.entries()) {
    const path = `${id}/${i + 1}.${p.ext}`;
    const { error } = await db.storage.from('talent-applications').upload(path, p.bytes, { contentType: p.type });
    if (error) {
      if (paths.length) await db.storage.from('talent-applications').remove(paths);
      console.error('upload gagal', error);
      return fail('Foto gagal di-upload. Coba lagi sebentar.', 500);
    }
    paths.push(path);
  }

  const { error } = await db.from('talent_applications').insert({
    id,
    name,
    birth_date: birthDate,
    telegram_username: telegram,
    city,
    about,
    photos: paths,
    ip_hash: ipHash,
  });
  if (error) {
    await db.storage.from('talent-applications').remove(paths);
    console.error('insert gagal', error);
    return fail('Pendaftaran gagal disimpan. Coba lagi sebentar.', 500);
  }

  return json({ ok: true });
});
