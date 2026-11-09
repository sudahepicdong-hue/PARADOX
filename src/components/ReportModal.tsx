import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { ReportReason } from '../types/talent';
import { createReport, REPORT_REASONS } from '../lib/db';

export interface ReportTarget {
  targetType: 'talent' | 'review';
  talentId: string;
  reviewId?: string;
  label: string; // contoh: "profil Valerie" atau "ulasan dari David"
}

interface ReportModalProps {
  target: ReportTarget;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ target, onClose }) => {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError('Pilih alasan laporan.');
      return;
    }
    setError('');
    setIsSending(true);
    try {
      await createReport({ ...target, reason, details: details.trim() });
      setIsSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim laporan. Coba lagi.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#090A10] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <Flag className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Laporkan {target.targetType === 'talent' ? 'Profil' : 'Ulasan'}</h3>
            <p className="text-xs text-slate-400">{target.label}</p>
          </div>
        </div>

        {isSent ? (
          <div className="space-y-4">
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
              Terima kasih. Laporan Anda sudah diterima dan akan ditinjau oleh admin.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    reason === key
                      ? 'border-rose-500/60 bg-rose-500/10 text-white'
                      : 'border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={key}
                    checked={reason === key}
                    onChange={() => setReason(key)}
                    className="accent-rose-500"
                  />
                  <span>{REPORT_REASONS[key]}</span>
                </label>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Keterangan tambahan (opsional)"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
            />

            {(reason === 'underage' || reason === 'coercion') && (
              <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg leading-relaxed">
                Jika ada seseorang dalam bahaya, segera hubungi polisi di 110. Untuk dugaan perdagangan orang atau
                eksploitasi anak, Anda juga bisa melapor ke SAPA 129 (KemenPPPA) atau WhatsApp 08111-129-129.
              </p>
            )}

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {isSending ? 'Mengirim...' : 'Kirim Laporan'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
