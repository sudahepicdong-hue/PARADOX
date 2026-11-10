import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fetchAdmins, setAdminRole, AdminAccount } from '../lib/db';
import { supabase } from '../lib/supabase';

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// Tambah / cabut admin lewat email. Orangnya harus sudah daftar akun di website.
export const ManageAdminsPanel: React.FC = () => {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetchAdmins()
      .then(setAdmins)
      .catch((e) => setMessage({ ok: false, text: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim();
    if (!target) return;
    setBusy('add');
    setMessage(null);
    try {
      await setAdminRole(target, true);
      setMessage({ ok: true, text: `${target} sekarang admin. Minta dia logout lalu login lagi supaya menu Admin muncul.` });
      setEmail('');
      load();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const removeAdmin = async (a: AdminAccount) => {
    if (!confirm(`Cabut akses admin dari ${a.email}? Akunnya tetap ada sebagai member biasa.`)) return;
    setBusy(a.id);
    setMessage(null);
    try {
      await setAdminRole(a.email, false);
      setMessage({ ok: true, text: `Akses admin ${a.email} sudah dicabut.` });
      load();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={addAdmin} className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" /> Tambah Admin
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Orangnya harus sudah <b className="text-slate-300">daftar akun</b> di website dengan email ini. Admin bisa melihat
            dokumen KTP talent dan mengubah semua data, jadi berikan hanya ke orang yang dipercaya.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-sm placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy === 'add' && <Loader2 className="w-4 h-4 animate-spin" />} Jadikan Admin
          </button>
        </div>
      </form>

      {message && (
        <p
          className={`text-xs flex items-start gap-2 p-3 rounded-lg border ${
            message.ok ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
          }`}
        >
          {message.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </p>
      )}

      <div className="p-4 rounded-xl bg-black/40 border border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-amber-400" /> Daftar Admin {!loading && `(${admins.length})`}
        </h3>
        {loading ? (
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {admins.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">
                    {a.name || a.email}
                    {a.id === currentUserId && <span className="ml-2 text-[10px] text-amber-400 font-semibold">(kamu)</span>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {a.email} · sejak {dateFmt.format(new Date(a.createdAt))}
                  </div>
                </div>
                {a.id !== currentUserId && (
                  <button
                    onClick={() => removeAdmin(a)}
                    disabled={busy !== null}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer disabled:opacity-60"
                  >
                    {busy === a.id ? 'Mencabut...' : 'Cabut Admin'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
