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
  inline_keyboard: [[
    { text: '🟢 Online', callback_data: 'online' },
    { text: '⚫ Offline', callback_data: 'offline' },
  ]],
};

const NOT_LINKED = 'Akun Telegram ini belum terhubung ke profil talent PARADOX.\nKirim /start lalu pilih nama profil Anda.';

const jakartaTime = (d: Date) =>
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
  '• /status — cek status sekarang\n\n' +
  `Kalau lupa /offline, status otomatis kembali Offline setelah ${ONLINE_HOURS} jam.\n\n` +
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
  await notifyAdmin('talent_linked', { talent_name: talent.name, username });
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

// Kabar dari database: permintaan disetujui / ditolak admin
async function handleInternal(event: string, data: Record<string, unknown>) {
  const chatId = Number(data.chat_id);
  if (!chatId) return;
  if (event === 'link_approved') {
    const talent = await linkedTalent(chatId);
    if (talent) await reply(chatId, '🎉 Admin menyetujui permintaan Anda.\n\n' + welcomeText(talent.name, talent.online_until));
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
      if (data === 'online' || data === 'offline') await setStatus(chatId, data === 'online');
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

    if (cmd === '/start') await handleStart(chatId, arg, msg.from ?? {});
    else if (cmd === '/online') await setStatus(chatId, true);
    else if (cmd === '/offline') await setStatus(chatId, false);
    else if (cmd === '/status') {
      const talent = await linkedTalent(chatId);
      if (talent) await reply(chatId, statusText(talent.online_until));
      else await reply(chatId, NOT_LINKED, false);
    } else if (!(await linkedTalent(chatId))) {
      await sendPicker(chatId);
    } else {
      await reply(chatId, 'Perintah yang tersedia:\n/online — tampil Online\n/offline — tampil Offline\n/status — cek status');
    }
  } catch (e) {
    console.error('talent-bot error', e);
  }
  // Selalu 200 supaya Telegram tidak mengirim ulang pesan yang sama terus-menerus
  return new Response('ok');
});
