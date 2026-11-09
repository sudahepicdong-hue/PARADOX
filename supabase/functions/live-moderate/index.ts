// Edge Function: moderasi ruang live.
//   action "kick" : keluarkan penonton dari siaran sekarang (bisa masuk lagi)
//   action "ban"  : blokir penonton dari siaran talent ini untuk seterusnya + keluarkan
// Hanya talent pemilik profil atau admin.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { RoomServiceClient } from 'npm:livekit-server-sdk@2';

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
    if (!livekitUrl || !apiKey || !apiSecret) return json({ error: 'LiveKit belum diatur di server.' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Siapa yang memanggil?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Silakan login dulu.' }, 401);

    const { data: me } = await admin.from('profiles').select('role, talent_id, name, email').eq('id', user.id).maybeSingle();

    const { action, talentId, identity, name } = await req.json();
    if (typeof talentId !== 'string' || typeof identity !== 'string') return json({ error: 'Data tidak lengkap.' }, 400);

    const isAdmin = me?.role === 'admin';
    const isOwner = me?.role === 'talent' && me?.talent_id === talentId;
    if (!isAdmin && !isOwner) return json({ error: 'Anda tidak punya akses moderasi untuk siaran ini.' }, 403);

    // Host tidak bisa dikeluarkan lewat sini
    if (identity.startsWith('host-')) return json({ error: 'Host tidak bisa dikeluarkan.' }, 400);

    const room = `talent-${talentId}`;
    const rooms = new RoomServiceClient(livekitUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), apiKey, apiSecret);
    const kick = () => rooms.removeParticipant(room, identity).catch(() => {}); // sudah keluar = tidak apa-apa

    const { data: talent } = await admin.from('talents').select('name').eq('id', talentId).maybeSingle();

    if (action === 'kick') {
      await kick();
      return json({ ok: true });
    }

    if (action === 'ban') {
      // Hanya penonton yang login yang bisa diblokir permanen (identity "user-<uuid>")
      const userId = identity.match(/^user-([0-9a-f-]{36})$/i)?.[1];
      if (!userId) {
        await kick();
        return json({ ok: true, note: 'Tamu tanpa akun hanya bisa dikeluarkan, tidak bisa diblokir permanen.' });
      }

      const { error } = await admin.from('live_bans').upsert(
        { talent_id: talentId, user_id: userId, user_name: String(name ?? '').slice(0, 80), created_by: user.id },
        { onConflict: 'talent_id,user_id', ignoreDuplicates: true }
      );
      if (error) throw error;
      await kick();

      await admin.from('admin_audit_log').insert({
        actor_id: user.id,
        actor_name: me?.name || me?.email || 'host',
        action: 'live.ban',
        target_type: 'talent',
        target_id: talentId,
        target_label: talent?.name ?? talentId,
        details: { viewer: String(name ?? '') },
      });
      return json({ ok: true });
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
