import React, { useCallback, useEffect, useState } from 'react';
import { Send, Check, X, Trash2, UserPlus, RotateCcw, Loader2, MapPin, PhoneCall } from 'lucide-react';
import {
  TalentApplication,
  ApplicationStatus,
  fetchApplications,
  getApplicationPhotoUrls,
  setApplicationStatus,
  deleteApplication
} from '../lib/db';

interface ApplicationsPanelProps {
  // Admin klik "Terima": buka form talent baru yang sudah terisi data pendaftar
  onAccept: (app: TalentApplication) => Promise<void>;
  onCountChange?: (newCount: number) => void;
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  baru: 'Baru',
  dihubungi: 'Sudah dihubungi',
  diterima: 'Diterima',
  ditolak: 'Ditolak'
};
const STATUS_STYLE: Record<ApplicationStatus, string> = {
  baru: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  dihubungi: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  diterima: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  ditolak: 'bg-slate-500/15 text-slate-400 border-slate-500/30'
};
const FILTERS: { id: 'aktif' | ApplicationStatus | 'semua'; label: string }[] = [
  { id: 'aktif', label: 'Perlu ditinjau' },
  { id: 'diterima', label: 'Diterima' },
  { id: 'ditolak', label: 'Ditolak' },
  { id: 'semua', label: 'Semua' }
];

const dateTime = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const ApplicationsPanel: React.FC<ApplicationsPanelProps> = ({ onAccept, onCountChange }) => {
  const [apps, setApps] = useState<TalentApplication[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('aktif');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await fetchApplications();
      setApps(list);
      onCountChange?.(list.filter((a) => a.status === 'baru').length);
      // Link foto sementara untuk semua pendaftar sekaligus
      const all = list.flatMap((a) => a.photos);
      const urls = await getApplicationPhotoUrls(all);
      const map: Record<string, string[]> = {};
      let i = 0;
      for (const a of list) {
        map[a.id] = urls.slice(i, i + a.photos.length);
        i += a.photos.length;
      }
      setPhotoUrls(map);
    } catch (e) {
      setError(`Gagal memuat pendaftar: ${errorText(e)}`);
      setApps([]);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  const shown = (apps ?? []).filter((a) =>
    filter === 'semua' ? true : filter === 'aktif' ? a.status === 'baru' || a.status === 'dihubungi' : a.status === filter
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-white font-bold text-base">Pendaftar Talent</h4>
          <p className="text-xs text-slate-400">
            Dari tombol "Daftar Jadi Talent" di website. Hubungi lewat Telegram, lalu Terima atau Tolak.
          </p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-xs cursor-pointer ${
                filter === f.id ? 'bg-red-600 border-red-500 text-white font-semibold' : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}

      {apps === null ? (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Belum ada pendaftar di sini.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {shown.map((a) => {
            const busy = busyId === a.id;
            const urls = photoUrls[a.id] ?? [];
            return (
              <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">
                      {a.name} <span className="font-normal text-slate-400">· {a.age} th</span>
                    </p>
                    <p className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>@{a.telegramUsername}</span>
                      {a.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {a.city}
                        </span>
                      )}
                      <span>{dateTime.format(new Date(a.createdAt))}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {urls.map((u, i) =>
                    u ? (
                      <button key={i} onClick={() => setZoom(u)} className="shrink-0 cursor-zoom-in">
                        <img src={u} alt={`Foto ${i + 1}`} className="w-20 h-28 object-cover rounded-lg border border-white/10" />
                      </button>
                    ) : null
                  )}
                </div>

                {a.about && <p className="text-xs text-slate-300 whitespace-pre-line break-words">{a.about}</p>}

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={`https://t.me/${a.telegramUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/30 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Chat Telegram
                  </a>

                  {a.status === 'baru' && (
                    <button
                      disabled={busy}
                      onClick={() => run(a.id, () => setApplicationStatus(a.id, 'dihubungi'))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <PhoneCall className="w-3.5 h-3.5" /> Tandai dihubungi
                    </button>
                  )}

                  {(a.status === 'baru' || a.status === 'dihubungi') && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => run(a.id, () => onAccept(a))}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Terima
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Tolak pendaftaran ${a.name}?`)) run(a.id, () => setApplicationStatus(a.id, 'ditolak'));
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </>
                  )}

                  {a.status === 'diterima' && (
                    <span className="px-3 py-1.5 text-xs text-emerald-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Sudah dibuatkan profil talent
                    </span>
                  )}

                  {a.status === 'ditolak' && (
                    <button
                      disabled={busy}
                      onClick={() => run(a.id, () => setApplicationStatus(a.id, 'baru'))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Tinjau ulang
                    </button>
                  )}

                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Hapus data & foto pendaftar ${a.name} secara permanen?`)) run(a.id, () => deleteApplication(a));
                    }}
                    className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                    title="Hapus data pendaftar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Foto pendaftar" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};
