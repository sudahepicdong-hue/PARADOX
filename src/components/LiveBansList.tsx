import React, { useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { fetchLiveBans, unbanViewer, LiveBan } from '../lib/db';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

// Daftar penonton yang diblokir dari siaran talent ini, dengan tombol buka blokir.
export const LiveBansList: React.FC<{ talentId: string }> = ({ talentId }) => {
  const [bans, setBans] = useState<LiveBan[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLiveBans(talentId).then(setBans).catch((e) => setError(errorText(e)));
  }, [talentId]);

  const unban = async (b: LiveBan) => {
    if (!confirm(`Buka blokir ${b.userName}?`)) return;
    try {
      await unbanViewer(talentId, b.userId);
      setBans((prev) => prev?.filter((x) => x.userId !== b.userId) ?? null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
      <div>
        <h5 className="text-sm font-bold text-white flex items-center gap-2">
          <Ban className="w-4 h-4 text-rose-400" /> Penonton Diblokir
        </h5>
        <p className="text-[11px] text-slate-400">Diblokir lewat tombol di chat live. Mereka tidak bisa menonton siaran ini.</p>
      </div>

      {bans === null ? (
        <p className="text-xs text-slate-400">Memuat...</p>
      ) : bans.length === 0 ? (
        <p className="text-xs text-slate-500">Tidak ada penonton yang diblokir.</p>
      ) : (
        <div className="space-y-1.5">
          {bans.map((b) => (
            <div key={b.userId} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
              <div className="flex-1">
                <span className="text-white font-semibold">{b.userName}</span>
                <span className="text-slate-500"> · sejak {b.createdAt}</span>
              </div>
              <button
                onClick={() => unban(b)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                Buka blokir
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
};
