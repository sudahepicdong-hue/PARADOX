// Cari "chat id" Telegram untuk TELEGRAM_ADMIN_CHAT_ID.
// Cara pakai:
//   1. Isi TELEGRAM_BOT_TOKEN di .env
//   2. Dari akun Telegram admin, buka bot kamu lalu kirim pesan apa saja (misalnya /start).
//      Untuk grup admin: masukkan bot ke grup, lalu kirim pesan di grup itu.
//   3. Jalankan: npm run telegram:chat-id
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN belum diisi di .env (dapatkan dari @BotFather di Telegram).');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const body = await res.json();
if (!body.ok) {
  console.error(`Telegram menolak: ${body.description ?? res.status}. Cek lagi TELEGRAM_BOT_TOKEN.`);
  process.exit(1);
}

const chats = new Map();
for (const u of body.result ?? []) {
  const chat = (u.message ?? u.channel_post ?? u.my_chat_member)?.chat;
  if (chat) chats.set(chat.id, chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ') ?? chat.username);
}

if (chats.size === 0) {
  console.log('Belum ada pesan masuk ke bot. Kirim /start ke bot dari Telegram admin, lalu jalankan lagi.');
} else {
  console.log('Chat yang pernah mengirim pesan ke bot:\n');
  for (const [id, name] of chats) console.log(`  ${id}   ${name}`);
  console.log('\nSalin angka chat admin ke TELEGRAM_ADMIN_CHAT_ID di .env (beberapa? pisahkan dengan koma),');
  console.log('lalu jalankan: npm run functions:deploy');
}
