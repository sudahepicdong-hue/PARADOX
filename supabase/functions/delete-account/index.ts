// Edge Function: member menghapus akunnya sendiri (hak hapus data, UU PDP No. 27/2022).
// Ikut terhapus otomatis oleh database: profil, ulasan, dan like milik akun ini.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data } = await admin.auth.getUser(token);
    const user = data?.user;
    if (!user) return json({ error: 'Silakan login dulu.' }, 401);

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role === 'admin') {
      return json({ error: 'Akun admin tidak bisa dihapus dari website. Hapus lewat Supabase Dashboard.' }, 403);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
