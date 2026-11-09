// Edge Function: membuat "tiket masuk" (token) ke ruang live LiveKit.
//   - role "host"   : talent pemilik profil / admin -> boleh kirim kamera & mic
//   - role "viewer" : siapa saja -> hanya menonton. Yang login boleh ikut chat.
// Secrets yang dibutuhkan (diset oleh `npm run functions:deploy`):
//   LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const livekitUrl = Deno.env.get('LIVEKIT_URL');
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    if (!livekitUrl || !apiKey || !apiSecret) {
      return json({ error: 'LiveKit belum diatur di server (LIVEKIT_URL / API_KEY / API_SECRET).' }, 500);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { talentId, role } = await req.json();
    if (typeof talentId !== 'string' || !talentId) return json({ error: 'talentId wajib diisi.' }, 400);
    const wantsHost = role === 'host';

    // Siapa yang meminta? (boleh tamu tanpa login untuk menonton)
    const authToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData } = authToken ? await admin.auth.getUser(authToken) : { data: { user: null } };
    const user = userData?.user ?? null;

    const { data: profile } = user
      ? await admin.from('profiles').select('name, role, talent_id').eq('id', user.id).maybeSingle()
      : { data: null };

    const isAdmin = profile?.role === 'admin';
    const isOwner = profile?.role === 'talent' && profile?.talent_id === talentId;

    const { data: talent } = await admin
      .from('talents')
      .select('id, name, is_active, id_verified_at')
      .eq('id', talentId)
      .maybeSingle();
    if (!talent) return json({ error: 'Talent tidak ditemukan.' }, 404);

    if (wantsHost && !isAdmin && !isOwner) {
      return json({ error: 'Anda tidak punya akses untuk siaran sebagai talent ini.' }, 403);
    }
    const isPublic = talent.is_active && talent.id_verified_at;
    if (!wantsHost && !isPublic && !isAdmin && !isOwner) {
      return json({ error: 'Siaran ini tidak tersedia.' }, 403);
    }

    // Penonton yang diblokir host tidak bisa masuk lagi ke siaran talent ini
    if (!wantsHost && user && !isAdmin && !isOwner) {
      const { data: ban } = await admin
        .from('live_bans')
        .select('user_id')
        .eq('talent_id', talentId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (ban) return json({ error: 'Anda diblokir dari siaran talent ini.' }, 403);
    }

    const identity = user ? `${wantsHost ? 'host' : 'user'}-${user.id}` : `tamu-${crypto.randomUUID()}`;
    const displayName = wantsHost ? talent.name : profile?.name || (user ? 'Member' : 'Tamu');

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      ttl: '4h',
      // host = talent yang siaran; moderator = admin yang menonton (boleh hapus pesan / keluarkan penonton)
      metadata: JSON.stringify({ role: wantsHost ? 'host' : isAdmin || isOwner ? 'moderator' : 'viewer' }),
    });
    at.addGrant({
      room: `talent-${talentId}`,
      roomJoin: true,
      canSubscribe: true,
      canPublish: wantsHost,
      // Chat & reaksi hanya untuk yang login (nama diambil dari akun, tidak bisa dipalsukan)
      canPublishData: Boolean(user),
    });

    return json({ token: await at.toJwt(), url: livekitUrl });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
