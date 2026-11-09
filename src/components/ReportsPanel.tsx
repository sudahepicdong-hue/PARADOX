import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, X, EyeOff, Trash2, RefreshCw } from 'lucide-react';
import { Report, Review, Talent } from '../types/talent';
import * as db from '../lib/db';

interface ReportsPanelProps {
  talents: Talent[];
  reviews: Review[];
  onDeleteReview: (reviewId: string) => Promise<boolean>; // true kalau benar-benar terhapus
  onTalentChanged: (talentId: string) => Promise<void>;
  onOpenVerification: (talentId: string) => void;
  onOpenCountChange?: (count: number) => void;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

export const ReportsPanel: React.FC<ReportsPanelProps> = ({
  talents,
  reviews,
  onDeleteReview,
  onTalentChanged,
  onOpenVerification,
  onOpenCountChange
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setReports(await db.fetchReports());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCount = reports.filter((r) => r.status === 'open').length;
  useEffect(() => {
    onOpenCountChange?.(openCount);
  }, [openCount]);

  const setStatus = async (report: Report, status: Report['status']) => {
    setBusyId(report.id);
    try {
      await db.setReportStatus(report.id, status);
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const hideTalent = async (report: Report) => {
    if (!report.talentId) return;
    setBusyId(report.id);
    try {
      await db.setTalentActive(report.talentId, false);
      await onTalentChanged(report.talentId);
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeReview = async (report: Report) => {
    if (!report.reviewId) return;
    setBusyId(report.id);
    try {
      if (await onDeleteReview(report.reviewId)) {
        await db.setReportStatus(report.id, 'resolved').catch(() => {});
        // Laporan untuk ulasan yang terhapus ikut terhapus otomatis oleh database
        setReports((prev) => prev.filter((r) => r.reviewId !== report.reviewId));
      }
    } finally {
      setBusyId(null);
    }
  };

  // Laporan mendesak (di bawah umur / paksaan) selalu di paling atas
  const visible = reports
    .filter((r) => filter === 'all' || r.status === 'open')
    .sort((a, b) => {
      const ua = db.URGENT_REASONS.includes(a.reason) && a.status === 'open' ? 0 : 1;
      const ub = db.URGENT_REASONS.includes(b.reason) && b.status === 'open' ? 0 : 1;
      return ua - ub;
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-white/10 text-xs">
          {(['open', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded cursor-pointer ${filter === f ? 'bg-white/10 text-white' : 'text-slate-400'}`}
            >
              {f === 'open' ? `Belum ditangani (${openCount})` : 'Semua'}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer" title="Muat ulang">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-slate-400">Memuat laporan...</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-slate-500 p-6 text-center">Tidak ada laporan.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const talent = talents.find((t) => t.id === r.talentId);
            const review = reviews.find((rv) => rv.id === r.reviewId);
            const urgent = db.URGENT_REASONS.includes(r.reason);
            return (
              <div
                key={r.id}
                className={`p-4 rounded-xl border space-y-2 ${
                  urgent && r.status === 'open' ? 'bg-rose-500/10 border-rose-500/50' : 'bg-black/40 border-white/10'
                } ${r.status !== 'open' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className={`font-bold flex items-center gap-1.5 ${urgent ? 'text-rose-300' : 'text-white'}`}>
                      {urgent && <AlertTriangle className="w-3.5 h-3.5" />}
                      {db.REPORT_REASONS[r.reason]}
                    </div>
                    <div className="text-slate-400">
                      {r.targetType === 'talent' ? 'Profil' : 'Ulasan'} · {talent?.name ?? r.talentId ?? '-'} · {r.createdAt}
                      {r.status !== 'open' && ` · ${r.status === 'resolved' ? 'Selesai' : 'Diabaikan'}`}
                    </div>
                  </div>
                </div>

                {review && (
                  <blockquote className="text-xs text-slate-300 border-l-2 border-white/20 pl-3">
                    "{review.comment}" — {review.userName}
                  </blockquote>
                )}
                {r.details && <p className="text-xs text-slate-300">Keterangan: {r.details}</p>}

                {r.status === 'open' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.targetType === 'talent' && r.talentId && (
                      <>
                        {talent?.isActive !== false && (
                          <button
                            onClick={() => hideTalent(r)}
                            disabled={busyId === r.id}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-600/80 hover:bg-rose-600 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <EyeOff className="w-3 h-3" /> Sembunyikan Profil
                          </button>
                        )}
                        <button
                          onClick={() => onOpenVerification(r.talentId!)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                        >
                          Cek Verifikasi
                        </button>
                      </>
                    )}
                    {r.targetType === 'review' && review && (
                      <button
                        onClick={() => removeReview(r)}
                        disabled={busyId === r.id}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-600/80 hover:bg-rose-600 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus Ulasan
                      </button>
                    )}
                    <button
                      onClick={() => setStatus(r, 'resolved')}
                      disabled={busyId === r.id}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600/80 hover:bg-emerald-600 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" /> Tandai Selesai
                    </button>
                    <button
                      onClick={() => setStatus(r, 'dismissed')}
                      disabled={busyId === r.id}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3 h-3" /> Abaikan
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
