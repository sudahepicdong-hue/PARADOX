// Edge Function: admin membuat / mengganti password login talent, atau menghapus akses login.
// Berjalan di server Supabase, jadi kunci service role tidak pernah sampai ke browser.
//
// Deploy:  npm run functions:deploy   (lihat scripts/deploy-functions.mjs)
// atau tempel file ini di Supabase Dashboard > Edge Functions > Deploy a new function > Via Editor
// dengan nama "admin-talent-account" dan matikan "Verify JWT" (pengecekan admin dilakukan di bawah).
import { createClient } from 'npm:@supabase/supabase-js@2';

// Harus sama dengan TALENT_EMAIL_DOMAIN di src/lib/db.ts.
// Domain ".invalid" sengaja dipakai supaya tidak ada email sungguhan yang bisa terkirim ke alamat ini.
const TALENT_EMAIL_DOMAIN = 'talent.paradox.invalid';

const talentEmail = (talentId: string) =>
  `${talentId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}@${TALENT_EMAIL_DOMAIN}`;

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

    // 1. Pastikan yang memanggil adalah admin
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json({ error: 'Silakan login sebagai admin.' }, 401);

    const { data: me } = await admin.from('profiles').select('role, name, email').eq('id', userData.user.id).maybeSingle();
    if (me?.role !== 'admin') return json({ error: 'Hanya admin yang boleh mengatur login talent.' }, 403);

    // Catat ke riwayat aktivitas admin (password TIDAK pernah dicatat)
    const audit = (action: string, talentId: string, label: string) =>
      admin.from('admin_audit_log').insert({
        actor_id: userData.user!.id,
        actor_name: me?.name || me?.email || 'admin',
        action,
        target_type: 'talent',
        target_id: talentId,
        target_label: label,
      });

    // 2. Baca permintaan
    const { action, talentId, password } = await req.json();
    if (typeof talentId !== 'string' || !talentId) return json({ error: 'talentId wajib diisi.' }, 400);

    const { data: talent } = await admin.from('talents').select('id, name').eq('id', talentId).maybeSingle();
    if (!talent) return json({ error: 'Talent tidak ditemukan.' }, 404);

    const { data: linkedRows } = await admin
      .from('profiles')
      .select('id, email')
      .eq('role', 'talent')
      .eq('talent_id', talentId)
      .limit(1);
    const linked = linkedRows?.[0] ?? null;

    // 3a. Buat login baru / ganti password
    if (action === 'set_password') {
      if (typeof password !== 'string' || password.length < 6) {
        return json({ error: 'Password minimal 6 karakter.' }, 400);
      }

      if (linked) {
        const { error } = await admin.auth.admin.updateUserById(linked.id, { password });
        if (error) throw error;
        await audit('talent.login_password', talentId, talent.name);
        return json({ ok: true, created: false });
      }

      const email = talentEmail(talentId);
      let userId: string;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: talent.name },
      });

      if (createErr) {
        // Mungkin akunnya sudah pernah dibuat tapi terlepas dari talent -> pakai lagi
        const { data: existing } = await admin.from('profiles').select('id').eq('email', email).limit(1);
        if (!existing?.length) throw createErr;
        userId = existing[0].id;
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
      } else {
        userId = created.user.id;
      }

      const { error: linkErr } = await admin
        .from('profiles')
        .update({ role: 'talent', talent_id: talentId, name: talent.name })
        .eq('id', userId);
      if (linkErr) throw linkErr;

      await audit('talent.login_create', talentId, talent.name);
      return json({ ok: true, created: true });
    }

    // 3b. Cabut akses login talent
    if (action === 'remove_login') {
      if (!linked) return json({ ok: true });
      if (linked.email?.endsWith(`@${TALENT_EMAIL_DOMAIN}`)) {
        // Akun khusus buatan admin -> hapus sekalian
        const { error } = await admin.auth.admin.deleteUser(linked.id);
        if (error) throw error;
      } else {
        // Akun email pribadi talent -> cukup dilepas, akunnya tetap ada sebagai member
        const { error } = await admin.from('profiles').update({ role: 'user', talent_id: null }).eq('id', linked.id);
        if (error) throw error;
      }
      await audit('talent.login_remove', talentId, talent.name);
      return json({ ok: true });
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400);
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
