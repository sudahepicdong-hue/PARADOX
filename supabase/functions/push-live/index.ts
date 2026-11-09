// Edge Function: kirim notifikasi push "🔴 <talent> sedang live!" ke semua perangkat
// member yang menyukai (like) talent tersebut.
// Dipanggil oleh DATABASE (trigger saat talent mulai live), bukan oleh website.
// Secrets: NOTIFY_WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUBLIC_SITE_URL
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const RESEND_AFTER_MS = 30 * 60_000; // talent yang sama live lagi < 30 menit: tidak dikirim ulang

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const site = (Deno.env.get('PUBLIC_SITE_URL') ?? '').replace(/\/+$/, '');
  if (!publicKey || !privateKey || !site) {
    return Response.json({ ok: true, skipped: 'VAPID / PUBLIC_SITE_URL belum diatur' });
  }

  try {
    const { talent_id } = await req.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: talent } = await admin
      .from('talents')
      .select('id, name, media, live_stream_title, is_active, id_verified_at, live_push_sent_at')
      .eq('id', talent_id)
      .maybeSingle();

    // Hanya talent yang tampil di publik
    if (!talent || !talent.is_active || !talent.id_verified_at) {
      return Response.json({ ok: true, skipped: 'talent tidak tampil di publik' });
    }
    if (talent.live_push_sent_at && Date.now() - new Date(talent.live_push_sent_at).getTime() < RESEND_AFTER_MS) {
      return Response.json({ ok: true, skipped: 'baru saja dikirim' });
    }
    await admin.from('talents').update({ live_push_sent_at: new Date().toISOString() }).eq('id', talent.id);

    // Siapa yang mengikuti (like) talent ini?
    const { data: likes } = await admin.from('likes').select('user_id').eq('talent_id', talent.id);
    const userIds = [...new Set((likes ?? []).map((l) => l.user_id))];
    if (userIds.length === 0) return Response.json({ ok: true, sent: 0 });

    const subs: { endpoint: string; p256dh: string; auth: string }[] = [];
    for (let i = 0; i < userIds.length; i += 200) {
      const { data } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', userIds.slice(i, i + 200));
      subs.push(...(data ?? []));
    }
    if (subs.length === 0) return Response.json({ ok: true, sent: 0 });

    const photo = (talent.media as { type: string; url: string }[] | null)?.find((m) => m.type === 'image')?.url;
    const payload = JSON.stringify({
      title: `🔴 ${talent.name} sedang live!`,
      body: talent.live_stream_title || 'Ketuk untuk menonton sekarang.',
      url: `${site}/?live=${encodeURIComponent(talent.id)}`,
      icon: `${site}/icons/icon-192.png`,
      image: photo ? (photo.startsWith('http') ? photo : `${site}${photo}`) : undefined,
      tag: `live-${talent.id}`,
    });

    webpush.setVapidDetails(site, publicKey, privateKey);

    let sent = 0;
    const expired: string[] = [];
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 30, urgency: 'high' }
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) expired.push(s.endpoint); // perangkat sudah berhenti berlangganan
        }
      })
    );

    if (expired.length) await admin.from('push_subscriptions').delete().in('endpoint', expired);

    return Response.json({ ok: true, sent, expired: expired.length });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }
});
