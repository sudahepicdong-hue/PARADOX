// Edge Function: webhook bot Telegram khusus talent.
// Talent menghubungkan akunnya lewat link /start <kode>, lalu mengatur status
// dengan /online, /offline, /status (atau tombol di bawah pesan bot).
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

const jakartaTime = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(d);

const reply = (chatId: number, text: string, withButtons = true) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...(withButtons ? { reply_markup: BUTTONS } : {}) });

async function linkedTalent(chatId: number) {
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
    await reply(chatId, 'Akun Telegram ini belum terhubung ke profil talent PARADOX.\nMinta link penghubung ke admin, lalu buka link itu.', false);
    return;
  }
  // Kalau admin sudah set "online terus", /online tidak memperpendeknya
  const until = !online ? null : isPinned(talent.online_until) ? talent.online_until : new Date(Date.now() + ONLINE_HOURS * 3600_000).toISOString();
  await db.from('talents').update({ online_until: until }).eq('id', talent.id);
  await reply(chatId, statusText(until));
}

async function handleStart(chatId: number, code: string | undefined, username: string | undefined) {
  if (!code) {
    const talent = await linkedTalent(chatId);
    if (talent) {
      await reply(chatId, `Halo <b>${esc(talent.name)}</b>!\n\n${statusText(talent.online_until)}`);
    } else {
      await reply(chatId, 'Halo! Bot ini untuk talent PARADOX.\nMinta link penghubung ke admin, lalu buka link itu untuk menghubungkan akun Anda.', false);
    }
    return;
  }

  const { data: row } = await db
    .from('talent_link_codes')
    .select('code, talent_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle();

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    await reply(chatId, '❌ Link ini sudah dipakai atau kedaluwarsa.\nMinta link baru ke admin PARADOX.', false);
    return;
  }

  const { data: talent } = await db.from('talents').select('id, name, online_until').eq('id', row.talent_id).maybeSingle();
  if (!talent) {
    await reply(chatId, '❌ Profil talent tidak ditemukan.', false);
    return;
  }

  // Satu akun Telegram hanya untuk satu talent: lepas sambungan lama kalau ada
  await db.from('talent_telegram_links').delete().eq('telegram_chat_id', chatId);
  await db.from('talent_telegram_links').upsert({
    talent_id: talent.id,
    telegram_chat_id: chatId,
    telegram_username: username ?? null,
    linked_at: new Date().toISOString(),
  });
  await db.from('talent_link_codes').update({ used_at: new Date().toISOString() }).eq('code', code);

  await reply(
    chatId,
    `✅ Terhubung sebagai <b>${esc(talent.name)}</b>.\n\n` +
      'Mulai sekarang atur status Anda di website PARADOX dari sini:\n' +
      '• /online — tampil Online di website\n' +
      '• /offline — tampil Offline\n' +
      '• /status — cek status sekarang\n\n' +
      `Kalau lupa /offline, status otomatis kembali Offline setelah ${ONLINE_HOURS} jam.\n\n` +
      statusText(talent.online_until)
  );

  // Beri tahu admin lewat fungsi notify-admin (Telegram admin)
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  await fetch(`${base}/functions/v1/notify-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
    body: JSON.stringify({ event: 'talent_linked', data: { talent_name: talent.name, username } }),
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  // Telegram mengirim secret_token yang kita daftarkan saat setWebhook
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = await req.json();

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      if (chatId && (cq.data === 'online' || cq.data === 'offline')) await setStatus(chatId, cq.data === 'online');
      return new Response('ok');
    }

    const msg = update.message;
    if (!msg?.chat?.id || msg.chat.type !== 'private') return new Response('ok');
    const chatId: number = msg.chat.id;
    const text: string = (msg.text ?? '').trim();
    const [cmdRaw, arg] = text.split(/\s+/, 2);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, '');

    if (cmd === '/start') await handleStart(chatId, arg, msg.from?.username);
    else if (cmd === '/online') await setStatus(chatId, true);
    else if (cmd === '/offline') await setStatus(chatId, false);
    else if (cmd === '/status') {
      const talent = await linkedTalent(chatId);
      if (talent) await reply(chatId, statusText(talent.online_until));
      else await reply(chatId, 'Akun Telegram ini belum terhubung ke profil talent PARADOX.', false);
    } else {
      await reply(chatId, 'Perintah yang tersedia:\n/online — tampil Online\n/offline — tampil Offline\n/status — cek status');
    }
  } catch (e) {
    console.error('talent-bot error', e);
  }
  // Selalu 200 supaya Telegram tidak mengirim ulang pesan yang sama terus-menerus
  return new Response('ok');
});
