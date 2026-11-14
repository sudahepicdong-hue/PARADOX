// Edge Function: webhook bot Telegram khusus talent.
// Talent menghubungkan akunnya lewat:
//  * link umum t.me/<bot> -> pilih nama profil di bot. Username Telegram sama dengan
//    username di profil -> langsung terhubung; tidak sama -> menunggu persetujuan admin.
//  * link sekali pakai /start <kode> dari admin (cara lama, tetap berlaku).
// Lalu mengatur status dengan /online, /offline, /status (atau tombol di bawah pesan bot).
// Database juga memanggil fungsi ini (body.internal) untuk mengabari talent
// saat permintaannya disetujui / ditolak admin.
// Secrets: TELEGRAM_TALENT_BOT_TOKEN, NOTIFY_WEBHOOK_SECRET (dipakai sebagai secret_token webhook)
import { createClient } from 'npm:@supabase/supabase-js@2';

const ONLINE_HOURS = 12; // otomatis kembali offline kalau talent lupa /offline

const token = Deno.env.get('TELEGRAM_TALENT_BOT_TOKEN') ?? '';
const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET') ?? '';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tg = (method: string, body: Record<string, unknown>) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BUTTONS = {
  inline_keyboard: [
    [
      { text: '🟢 Online', callback_data: 'online' },
      { text: '⚫ Offline', callback_data: 'offline' },
    ],
    [{ text: '🔑 Login Website', callback_data: 'login' }],
  ],
};

// Harus sama dengan TALENT_EMAIL_DOMAIN di src/lib/db.ts & admin-talent-account
const TALENT_EMAIL_DOMAIN = 'talent.paradox.invalid';
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://paradox-oikz5.sevalla.page').replace(/\/+$/, '');

const NOT_LINKED = 'Akun Telegram ini belum terhubung ke profil talent PARADOX.\nKirim /start lalu pilih nama profil Anda.';

const USERNAME_MISSING =
  '⚠️ <b>Username Telegram Anda kosong.</b>\n\n' +
  'Pelanggan di website tidak bisa menghubungi Anda, dan username lama bisa diambil orang lain. ' +
  'Status Anda dibuat <b>Offline</b> dan /online tidak bisa dipakai dulu.\n\n' +
  'Pasang username lagi: Telegram → Settings → Username. Setelah itu kirim /online lagi ke bot ini — ' +
  'profil website otomatis ikut diperbarui.';

const jakartaTime =(d: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(d);

const reply = (chatId: number, text: string, withButtons = true) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...(withButtons ? { reply_markup: BUTTONS } : {}) });

type TalentRow = { id: string; name: string; online_until: string | null };
type From = { username?: string; first_name?: string; last_name?: string };

async function linkedTalent(chatId: number): Promise<TalentRow | null> {
  const { data: link } = await db
    .from('talent_telegram_links')
    .select('talent_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (!link) return null;
  const { data: talent } = await db.from('talents').select('id, name, online_until').eq('id', link.talent_id).maybeSingle();
  return talent;
}

const isPinned = (onlineUntil: string | null) => Boolean(onlineUntil) && new Date(onlineUntil!).getUTCFullYear() >= 9999;

const statusText = (onlineUntil: string | null) => {
  if (isPinned(onlineUntil)) {
    return '🟢 Status Anda: <b>Online</b> (diatur admin, tetap online sampai dimatikan).\nKirim /offline kalau sudah selesai.';
  }
  if (onlineUntil && new Date(onlineUntil) > new Date()) {
    return `🟢 Status Anda: <b>Online</b> sampai ${jakartaTime(new Date(onlineUntil))} WIB.\nKirim /offline kalau sudah selesai.`;
  }
  return '⚫ Status Anda: <b>Offline</b>.\nKirim /online kalau siap menerima chat.';
};

async function setStatus(chatId: number, online: boolean) {
  const talent = await linkedTalent(chatId);
  if (!talent) {
    await reply(chatId, NOT_LINKED, false);
    return;
  }
  if (online) {
    const { data: link } = await db
      .from('talent_telegram_links')
      .select('username_missing_since')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();
    if (link?.username_missing_since) {
      await reply(chatId, USERNAME_MISSING, false);
      return;
    }
  }
  // Kalau admin sudah set "online terus", /online tidak memperpendeknya
  const until = !online ? null : isPinned(talent.online_until) ? talent.online_until : new Date(Date.now() + ONLINE_HOURS * 3600_000).toISOString();
  await db.from('talents').update({ online_until: until }).eq('id', talent.id);
  await reply(chatId, statusText(until));
}

// Username Telegram tanpa @ / t.me/, huruf kecil
const normUser = (u: unknown) =>
  String(u ?? '').trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').toLowerCase();

async function notifyAdmin(event: string, data: Record<string, unknown>) {
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  await fetch(`${base}/functions/v1/notify-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
    body: JSON.stringify({ event, data }),
  }).catch(() => undefined);
}

const welcomeText = (name: string, onlineUntil: string | null) =>
  `✅ Terhubung sebagai <b>${esc(name)}</b>.\n\n` +
  'Mulai sekarang atur status Anda di website PARADOX dari sini:\n' +
  '• /online — tampil Online di website\n' +
  '• /offline — tampil Offline\n' +
  '• /status — cek status sekarang\n' +
  '• /login — masuk ke website tanpa password\n\n' +
  `Kalau lupa /offline, status otomatis kembali Offline setelah ${ONLINE_HOURS} jam.\n` +
  'Setiap jam 07.00 WIB semua status di-reset jadi Offline, jadi absen /online lagi tiap hari.\n\n' +
  statusText(onlineUntil);

// Hubungkan akun Telegram ke talent (1 akun = 1 talent, 1 talent = 1 akun)
async function linkChat(chatId: number, talent: TalentRow, username: string | undefined) {
  await db.from('talent_telegram_links').delete().eq('telegram_chat_id', chatId);
  await db.from('talent_telegram_links').delete().eq('talent_id', talent.id);
  await db.from('talent_telegram_links').insert({
    talent_id: talent.id,
    telegram_chat_id: chatId,
    telegram_username: username ?? null,
    linked_at: new Date().toISOString(),
  });
  await db.from('talent_link_requests').delete().eq('telegram_chat_id', chatId);
  await reply(chatId, welcomeText(talent.name, talent.online_until));
  await notifyAdmin('talent_linked', { talent_name: talent.name, username, telegram_id: chatId });
}

// Daftar profil yang belum terhubung, sebagai tombol
async function sendPicker(chatId: number) {
  const [{ data: talents }, { data: links }] = await Promise.all([
    db.from('talents').select('id, name').order('name'),
    db.from('talent_telegram_links').select('talent_id'),
  ]);
  const taken = new Set((links ?? []).map((l) => l.talent_id));
  const free = (talents ?? []).filter((t) => !taken.has(t.id) && `pick:${t.id}`.length <= 64);
  if (!free.length) {
    await reply(chatId, 'Semua profil talent sudah terhubung.\nKalau profil Anda terhubung ke akun yang salah, hubungi admin PARADOX.', false);
    return;
  }
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < free.length; i += 2) {
    rows.push(free.slice(i, i + 2).map((t) => ({ text: t.name, callback_data: `pick:${t.id}` })));
  }
  await tg('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: '👋 Halo! Bot ini untuk absen talent PARADOX.\n\n<b>Pilih nama profil Anda</b> di bawah ini:',
    reply_markup: { inline_keyboard: rows },
  });
}

async function handlePick(chatId: number, messageId: number | undefined, talentId: string, from: From) {
  const done = (text: string) =>
    messageId
      ? tg('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' })
      : reply(chatId, text, false);

  const current = await linkedTalent(chatId);
  if (current) {
    await done(`Akun ini sudah terhubung sebagai <b>${esc(current.name)}</b>.\nKalau ingin ganti profil, hubungi admin PARADOX.`);
    return;
  }

  const { data: talent } = await db
    .from('talents')
    .select('id, name, online_until, telegram_username')
    .eq('id', talentId)
    .maybeSingle();
  if (!talent) {
    await done('❌ Profil tidak ditemukan. Kirim /start untuk memilih lagi.');
    return;
  }
  const { data: taken } = await db.from('talent_telegram_links').select('talent_id').eq('talent_id', talent.id).maybeSingle();
  if (taken) {
    await done(`❌ Profil <b>${esc(talent.name)}</b> sudah terhubung ke akun Telegram lain.\nKalau itu profil Anda, hubungi admin PARADOX.`);
    return;
  }

  // Username Telegram cocok dengan profil -> langsung terhubung
  if (from.username && normUser(from.username) === normUser(talent.telegram_username)) {
    await done(`Anda memilih <b>${esc(talent.name)}</b>.`);
    await linkChat(chatId, talent, from.username);
    return;
  }

  // Tidak cocok -> minta persetujuan admin
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 80) || null;
  await db.from('talent_link_requests').delete().eq('telegram_chat_id', chatId);
  await db.from('talent_link_requests').insert({
    talent_id: talent.id,
    telegram_chat_id: chatId,
    telegram_username: from.username ?? null,
    telegram_name: name,
  });
  await done(
    `⏳ Permintaan menghubungkan ke <b>${esc(talent.name)}</b> sudah dikirim ke admin.\n\n` +
      'Username Telegram Anda berbeda dengan yang tercatat di profil, jadi admin perlu menyetujui dulu. ' +
      'Anda akan dapat pesan di sini setelah disetujui.'
  );
  await notifyAdmin('talent_link_request', {
    talent_name: talent.name,
    username: from.username,
    name,
    profile_username: normUser(talent.telegram_username) || null,
  });
}

async function handleStart(chatId: number, code: string | undefined, from: From) {
  if (!code) {
    const talent = await linkedTalent(chatId);
    if (talent) {
      await reply(chatId, `Halo <b>${esc(talent.name)}</b>!\n\n${statusText(talent.online_until)}`);
      return;
    }
    const { data: pending } = await db
      .from('talent_link_requests')
      .select('talent_id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle();
    if (pending) {
      const { data: t } = await db.from('talents').select('name').eq('id', pending.talent_id).maybeSingle();
      await tg('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `⏳ Permintaan Anda untuk <b>${esc(t?.name ?? '-')}</b> masih menunggu persetujuan admin.`,
        reply_markup: { inline_keyboard: [[{ text: '🔁 Pilih profil lain', callback_data: 'repick' }]] },
      });
      return;
    }
    await sendPicker(chatId);
    return;
  }

  // Link sekali pakai dari admin (cara lama)
  const { data: row } = await db
    .from('talent_link_codes')
    .select('code, talent_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle();

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    await reply(chatId, '❌ Link ini sudah dipakai atau kedaluwarsa.\nKirim /start untuk memilih profil Anda.', false);
    return;
  }

  const { data: talent } = await db.from('talents').select('id, name, online_until').eq('id', row.talent_id).maybeSingle();
  if (!talent) {
    await reply(chatId, '❌ Profil talent tidak ditemukan.', false);
    return;
  }

  await db.from('talent_link_codes').update({ used_at: new Date().toISOString() }).eq('code', code);
  await linkChat(chatId, talent, from.username);
}

// Akun login website milik talent; dibuat otomatis kalau belum ada
async function loginEmailFor(talent: TalentRow): Promise<string> {
  const { data: rows } = await db.from('profiles').select('id, email').eq('role', 'talent').eq('talent_id', talent.id).limit(1);
  if (rows?.[0]?.email) return rows[0].email;

  const email = `${talent.id.toLowerCase().replace(/[^a-z0-9-]/g, '-')}@${TALENT_EMAIL_DOMAIN}`;
  const password = crypto.randomUUID() + crypto.randomUUID(); // acak & tidak dipakai: talent masuk lewat /login
  let userId: string;
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: talent.name },
  });
  if (error) {
    const { data: existing } = await db.from('profiles').select('id').eq('email', email).limit(1);
    if (!existing?.length) throw error;
    userId = existing[0].id;
  } else {
    userId = created.user.id;
  }
  const { error: linkErr } = await db
    .from('profiles')
    .update({ role: 'talent', talent_id: talent.id, name: talent.name })
    .eq('id', userId);
  if (linkErr) throw linkErr;
  return email;
}

// /login: kirim tombol masuk website (sekali pakai) ke talent yang sudah terhubung
async function sendLogin(chatId: number) {
  const talent = await linkedTalent(chatId);
  if (!talent) {
    await reply(chatId, NOT_LINKED, false);
    return;
  }
  try {
    const email = await loginEmailFor(talent);
    const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
    const hash = data?.properties?.hashed_token;
    if (error || !hash) throw error ?? new Error('no token');
    await tg('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text:
        `🔑 Tombol masuk website untuk <b>${esc(talent.name)}</b>.\n\n` +
        'Hanya bisa dipakai <b>1 kali</b> dan berlaku 1 jam. Jangan teruskan ke orang lain.\n' +
        'Kalau sudah tidak berlaku, ketik /login lagi.',
      reply_markup: {
        inline_keyboard: [[{ text: '➡️ Masuk ke Website', url: `${SITE_URL}/?tl=${encodeURIComponent(hash)}` }]],
      },
    });
  } catch (e) {
    console.error('login link error', e);
    await reply(chatId, '❌ Gagal membuat tombol login. Coba lagi sebentar, atau hubungi admin PARADOX.');
  }
}

// Talent ganti username Telegram: sambungan tetap (pakai ID), username dicatat ulang.
// Username di profil website ikut diganti HANYA kalau sebelumnya sama dengan akun ini
// (kalau talent sengaja pakai akun lain untuk pelanggan, jangan ditimpa).
async function syncUsername(chatId: number, from: From) {
  const newUsername = from.username;
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 80) || null;
  const { data: link } = await db
    .from('talent_telegram_links')
    .select('talent_id, telegram_username, telegram_name, username_missing_since')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (!link) return;

  if (fullName && fullName !== link.telegram_name) {
    await db.from('talent_telegram_links').update({ telegram_name: fullName }).eq('telegram_chat_id', chatId);
  }
  const history = (oldU: string | null, newU: string | null) =>
    db.from('talent_username_history').insert({ talent_id: link.talent_id, telegram_chat_id: chatId, old_username: oldU, new_username: newU });
  const who = { telegram_id: chatId, telegram_name: fullName };

  // Username dihapus: link "Chat Telegram" di website mati & username lama bisa diambil orang lain
  if (!newUsername) {
    if (link.username_missing_since || !link.telegram_username) return; // sudah ditangani / memang tidak pernah ada
    const { data: talent } = await db.from('talents').select('name, telegram_username').eq('id', link.talent_id).maybeSingle();
    if (!talent) return;
    await history(link.telegram_username, null);
    const profileAffected = normUser(talent.telegram_username) === normUser(link.telegram_username);
    if (profileAffected) {
      // Simpan username terakhir supaya profil bisa ikut diperbarui saat username dipasang lagi
      await db.from('talent_telegram_links').update({ username_missing_since: new Date().toISOString() }).eq('telegram_chat_id', chatId);
      await db.from('talents').update({ online_until: null }).eq('id', link.talent_id);
      await reply(chatId, USERNAME_MISSING, false);
    } else {
      await db.from('talent_telegram_links').update({ telegram_username: null }).eq('telegram_chat_id', chatId);
    }
    await notifyAdmin('talent_username_removed', {
      talent_name: talent.name,
      old_username: link.telegram_username,
      profile_affected: profileAffected,
      ...who,
    });
    return;
  }

  if (link.username_missing_since) {
    await db.from('talent_telegram_links').update({ username_missing_since: null }).eq('telegram_chat_id', chatId);
  }
  if (normUser(link.telegram_username) === normUser(newUsername)) return;

  const old = link.telegram_username;
  await db.from('talent_telegram_links').update({ telegram_username: newUsername }).eq('telegram_chat_id', chatId);
  await history(old, newUsername);

  const { data: talent } = await db.from('talents').select('name, telegram_username').eq('id', link.talent_id).maybeSingle();
  if (!talent) return;
  const profileUpdated = Boolean(old) && normUser(talent.telegram_username) === normUser(old);
  if (profileUpdated) {
    await db.from('talents').update({ telegram_username: newUsername }).eq('id', link.talent_id);
  }
  await notifyAdmin('talent_username_changed', {
    talent_name: talent.name,
    old_username: old,
    new_username: newUsername,
    profile_updated: profileUpdated,
    profile_username: normUser(talent.telegram_username) || null,
    ...who,
  });
}

// Reset harian 07.00 WIB (dari pg_cron): kabari semua talent yang terhubung bahwa status
// sudah Offline, dan ingatkan untuk absen /online lagi.
async function sendDailyReminders() {
  const { data: links } = await db.from('talent_telegram_links').select('telegram_chat_id, talent_id');
  if (!links?.length) return;
  const { data: talents } = await db
    .from('talents')
    .select('id, name')
    .in('id', links.map((l) => l.talent_id));
  const names = new Map((talents ?? []).map((t) => [t.id, t.name]));
  for (const l of links) {
    const name = names.get(l.talent_id);
    if (!name) continue;
    await reply(
      Number(l.telegram_chat_id),
      `🌅 Selamat pagi, <b>${esc(name)}</b>!\n\n` +
        'Status Anda sekarang <b>Offline</b> (reset otomatis setiap jam 07.00 WIB).\n\n' +
        '⏰ Jangan lupa absen hari ini: tekan <b>🟢 Online</b> di bawah atau kirim /online kalau sudah siap menerima chat.'
    );
    await new Promise((r) => setTimeout(r, 50)); // jaga batas kirim Telegram
  }
}

// Kabar dari database: permintaan disetujui / ditolak admin
async function handleInternal(event: string, data: Record<string, unknown>) {
  if (event === 'daily_reset') {
    await sendDailyReminders();
    return;
  }
  const chatId = Number(data.chat_id);
  if (!chatId) return;
  if (event === 'link_approved') {
    const talent = await linkedTalent(chatId);
    if (talent) await reply(chatId, '🎉 Admin menyetujui permintaan Anda.\n\n' + welcomeText(talent.name, talent.online_until));
  } else if (event === 'admin_message') {
    await tg('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `📩 <b>Pesan dari admin PARADOX:</b>\n\n${esc(data.text)}\n\n<i>Balas langsung di chat ini, pesan Anda akan diteruskan ke admin.</i>`,
    });
  } else if (event === 'link_rejected') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '❌ Permintaan Anda ditolak admin.\nPastikan memilih profil yang benar, atau hubungi admin PARADOX.',
      reply_markup: { inline_keyboard: [[{ text: '🔁 Pilih profil lagi', callback_data: 'repick' }]] },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  // Telegram (dan database) mengirim secret_token yang kita daftarkan saat setWebhook
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = await req.json();

    if (typeof update.internal === 'string') {
      await handleInternal(update.internal, update.data ?? {});
      return new Response('ok');
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      const data = String(cq.data ?? '');
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      if (!chatId || cq.message?.chat?.type !== 'private') return new Response('ok');
      await syncUsername(chatId, cq.from ?? {});
      if (data === 'online' || data === 'offline') await setStatus(chatId, data === 'online');
      else if (data === 'login') await sendLogin(chatId);
      else if (data.startsWith('pick:')) await handlePick(chatId, cq.message?.message_id, data.slice(5), cq.from ?? {});
      else if (data === 'repick') {
        await db.from('talent_link_requests').delete().eq('telegram_chat_id', chatId);
        await sendPicker(chatId);
      }
      return new Response('ok');
    }

    const msg = update.message;
    if (!msg?.chat?.id || msg.chat.type !== 'private') return new Response('ok');
    const chatId: number = msg.chat.id;
    const text: string = (msg.text ?? '').trim();
    const [cmdRaw, arg] = text.split(/\s+/, 2);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, '');
    await syncUsername(chatId, msg.from ?? {});

    if (cmd === '/start') await handleStart(chatId, arg, msg.from ?? {});
    else if (cmd === '/online') await setStatus(chatId, true);
    else if (cmd === '/offline') await setStatus(chatId, false);
    else if (cmd === '/login') await sendLogin(chatId);
    else if (cmd === '/status') {
      const talent = await linkedTalent(chatId);
      if (talent) await reply(chatId, statusText(talent.online_until));
      else await reply(chatId, NOT_LINKED, false);
    } else {
      const talent = await linkedTalent(chatId);
      if (!talent) {
        await sendPicker(chatId);
      } else if (cmd.startsWith('/')) {
        await reply(chatId, 'Perintah yang tersedia:\n/online — tampil Online\n/offline — tampil Offline\n/status — cek status\n/login — masuk ke website');
      } else {
        // Pesan biasa dari talent -> teruskan ke admin
        const body = text || (msg.caption ?? '').trim();
        if (!body) {
          await reply(chatId, 'Untuk saat ini bot hanya bisa meneruskan pesan teks ke admin.', false);
        } else {
          await notifyAdmin('talent_message', {
            talent_name: talent.name,
            username: msg.from?.username,
            telegram_id: chatId,
            text: body.slice(0, 3000),
          });
          await reply(chatId, '✅ Pesan Anda sudah diteruskan ke admin PARADOX.', false);
        }
      }
    }
  } catch (e) {
    console.error('talent-bot error', e);
  }
  // Selalu 200 supaya Telegram tidak mengirim ulang pesan yang sama terus-menerus
  return new Response('ok');
});
