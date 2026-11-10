// Edge Function: kirim notifikasi Telegram ke admin.
// Dipanggil oleh DATABASE (trigger + pg_net), bukan oleh website.
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID (boleh beberapa, pisahkan koma),
//          NOTIFY_WEBHOOK_SECRET (diisi otomatis oleh deploy script), PUBLIC_SITE_URL (opsional)

const REASONS: Record<string, string> = {
  underage: 'Dugaan di bawah umur',
  coercion: 'Dugaan paksaan / perdagangan orang',
  fake: 'Profil palsu / penipuan',
  inappropriate: 'Konten tidak pantas',
  spam: 'Spam',
  other: 'Lainnya',
};
const URGENT = ['underage', 'coercion'];
const DOC_TYPES: Record<string, string> = { ktp: 'KTP', paspor: 'Paspor', sim: 'SIM', lainnya: 'Dokumen lain' };

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildMessage(event: string, d: Record<string, unknown>, siteUrl: string): string | null {
  const link = siteUrl ? `\n\n<a href="${esc(siteUrl)}">Buka website</a>` : '';
  switch (event) {
    case 'report': {
      const urgent = URGENT.includes(String(d.reason));
      const head = urgent ? '🚨 <b>LAPORAN MENDESAK</b>' : '🚩 <b>Laporan baru</b>';
      const target = d.target_type === 'review' ? 'Ulasan di profil' : 'Profil';
      return (
        `${head}\n\nAlasan: <b>${esc(REASONS[String(d.reason)] ?? d.reason)}</b>\n` +
        `${target}: <b>${esc(d.talent_name ?? d.talent_id)}</b>` +
        (d.details ? `\nKeterangan: ${esc(d.details)}` : '') +
        (urgent ? '\n\nSegera periksa dan sembunyikan profil jika perlu (Admin Studio → Laporan).' : '\n\nTinjau di Admin Studio → Laporan.') +
        link
      );
    }
    case 'live_start':
      return `🔴 <b>${esc(d.talent_name)}</b> mulai live` + (d.title ? `\n"${esc(d.title)}"` : '') + link;
    case 'document_uploaded':
      return (
        `🪪 <b>${esc(d.talent_name ?? d.talent_id)}</b> mengupload dokumen identitas (${esc(DOC_TYPES[String(d.doc_type)] ?? d.doc_type)}).\n\n` +
        'Menunggu verifikasi: Admin Studio → Kelola Talent → ikon perisai.' +
        link
      );
    case 'talent_linked':
      return (
        `🔗 <b>${esc(d.talent_name)}</b> menghubungkan akun Telegram` +
        (d.username ? ` (@${esc(d.username)})` : '') +
        ' ke bot status talent.\n\nKalau ini bukan talent yang benar, putuskan sambungannya di Admin Studio → Kelola Talent → ikon perisai.' +
        link
      );
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatIds = (Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!botToken || chatIds.length === 0) {
    return Response.json({ ok: true, skipped: 'Telegram belum diatur' });
  }

  const { event, data } = await req.json();
  const text = buildMessage(String(event), data ?? {}, Deno.env.get('PUBLIC_SITE_URL') ?? '');
  if (!text) return Response.json({ ok: true, skipped: 'event tidak dikenal' });

  const results = await Promise.all(
    chatIds.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      }).then((r) => r.ok)
    )
  );

  return Response.json({ ok: results.every(Boolean) });
});
