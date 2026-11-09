import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAdminStats, AdminStats } from '../lib/db';

const RANGES = [7, 30, 90] as const;
const num = new Intl.NumberFormat('id-ID');
const dayLabel = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const dayLong = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

// Kotak angka ringkasan
const Tile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="p-4 rounded-xl bg-black/40 border border-white/10">
    <div className="text-[11px] text-slate-400">{label}</div>
    <div className="text-2xl font-bold text-white tabular-nums mt-1">{num.format(value)}</div>
  </div>
);

// Grafik batang kunjungan profil per hari (satu seri -> satu warna, tanpa legenda)
const DailyViewsChart: React.FC<{ daily: AdminStats['daily'] }> = ({ daily }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.views));
  const showEvery = Math.ceil(daily.length / 8); // label tanggal secukupnya supaya tidak bertumpuk

  return (
    <div className="p-4 rounded-xl bg-black/40 border border-white/10">
      <div className="text-xs font-semibold text-slate-200 mb-3">Kunjungan profil per hari</div>
      <div className="relative">
        {/* garis bantu tipis di nilai tertinggi */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/10" />
        <div className="absolute right-0 -top-4 text-[10px] text-slate-500 tabular-nums">{num.format(max)}</div>

        <div className="flex items-end h-36 gap-[2px]" onMouseLeave={() => setHover(null)}>
          {daily.map((d, i) => {
            const h = (d.views / max) * 100;
            return (
              <div
                key={d.day}
                className="relative flex-1 h-full flex items-end cursor-default"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-red-400' : 'bg-red-500/80'}`}
                  style={{ height: `${Math.max(h, d.views > 0 ? 2 : 0)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/20" />

        {hover !== null && daily[hover] && (
          <div
            className="absolute -top-2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-[#1a1d27] border border-white/15 text-[11px] text-slate-200 whitespace-nowrap pointer-events-none shadow-lg"
            style={{ left: `${((hover + 0.5) / daily.length) * 100}%`, transform: 'translate(-50%, -100%)' }}
          >
            <div className="text-slate-400">{dayLong.format(new Date(daily[hover].day))}</div>
            <div className="font-semibold text-white tabular-nums">{num.format(daily[hover].views)} kunjungan</div>
          </div>
        )}

        <div className="flex mt-1.5">
          {daily.map((d, i) => (
            <div key={d.day} className="flex-1 text-center text-[9px] text-slate-500 truncate">
              {i % showEvery === 0 ? dayLabel.format(new Date(d.day)) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Tab "Statistik" di panel admin
export const AdminStatsPanel: React.FC = () => {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async (d = days) => {
    setIsLoading(true);
    setError('');
    try {
      setStats(await fetchAdminStats(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as any)?.message ?? e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, [days]);

  return (
    <div className="space-y-4">
      {/* Filter rentang waktu */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/10 text-xs">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 rounded cursor-pointer ${days === r ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {r} hari
            </button>
          ))}
        </div>
        <button onClick={() => load()} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer" title="Muat ulang">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">{error}</p>}

      {isLoading && !stats ? (
        <p className="text-xs text-slate-400">Memuat statistik...</p>
      ) : stats ? (
        <div className={`space-y-4 ${isLoading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Tile label="Kunjungan profil" value={stats.totals.profile_views} />
            <Tile label="Sesi live" value={stats.totals.live_sessions} />
            <Tile label="Penonton live terbanyak" value={stats.totals.peak_live_viewers} />
            <Tile label="Like baru" value={stats.totals.new_likes} />
            <Tile label="Ulasan baru" value={stats.totals.new_reviews} />
            <Tile label="Member baru" value={stats.totals.new_members} />
          </div>

          <DailyViewsChart daily={stats.daily} />

          {/* Rincian per talent (juga berfungsi sebagai tampilan tabel data) */}
          <div className="rounded-xl border border-white/10 bg-black/40 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left border-b border-white/10">
                  <th className="px-3 py-2 font-semibold">Talent</th>
                  <th className="px-3 py-2 font-semibold text-right">Kunjungan</th>
                  <th className="px-3 py-2 font-semibold text-right">Sesi live</th>
                  <th className="px-3 py-2 font-semibold text-right">Penonton max</th>
                  <th className="px-3 py-2 font-semibold text-right">Like</th>
                  <th className="px-3 py-2 font-semibold text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.talents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">Belum ada talent.</td>
                  </tr>
                ) : (
                  stats.talents.map((t) => (
                    <tr key={t.id} className="text-slate-200">
                      <td className="px-3 py-2">
                        {t.name}
                        {!t.visible && <span className="ml-1.5 text-[10px] text-slate-500">(tidak tampil)</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{num.format(t.views)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num.format(t.live_sessions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num.format(t.peak_viewers)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num.format(t.likes)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.reviews > 0 ? `${Number(t.rating).toFixed(1)} (${t.reviews})` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">
            Kunjungan dihitung sekali per talent per sesi browser. Tidak ada data pribadi pengunjung yang disimpan.
          </p>
        </div>
      ) : null}
    </div>
  );
};
