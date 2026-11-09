import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchAuditLog, AuditEntry, REPORT_REASONS } from '../lib/db';
import { ReportReason } from '../types/talent';

// Terjemahan kode aksi ke kalimat yang mudah dibaca
const ACTION_LABELS: Record<string, string> = {
  'talent.create': 'menambah talent',
  'talent.update': 'mengedit talent',
  'talent.self_update': 'mengedit profilnya sendiri',
  'talent.delete': 'menghapus talent',
  'talent.self_delete': 'menghapus profilnya sendiri',
  'talent.verify': 'memverifikasi talent',
  'talent.unverify': 'mencabut verifikasi talent',
  'talent.hide': 'menyembunyikan talent',
  'talent.show': 'menampilkan talent',
  'talent.login_create': 'membuat login untuk talent',
  'talent.login_password': 'mengganti password talent',
  'talent.login_remove': 'mencabut login talent',
  'document.upload': 'mengupload dokumen identitas',
  'document.delete': 'menghapus dokumen identitas',
  'review.delete': 'menghapus ulasan dari',
  'report.resolved': 'menyelesaikan laporan',
  'report.dismissed': 'mengabaikan laporan',
  'report.open': 'membuka ulang laporan',
  'settings.update': 'mengubah',
  'live.ban': 'memblokir penonton dari siaran',
  'live.unban': 'membuka blokir penonton di siaran'
};

const describe = (e: AuditEntry) => {
  const action = ACTION_LABELS[e.action] ?? e.action;
  let target = e.targetLabel ?? e.targetId ?? '';
  if (e.targetType === 'report') target = REPORT_REASONS[target as ReportReason] ?? target;
  return { action, target };
};

const detailText = (e: AuditEntry) => {
  const d = e.details as Record<string, any>;
  if (Array.isArray(d.fields)) return `Kolom: ${d.fields.join(', ')}`;
  if (d.doc_type) return `Jenis: ${String(d.doc_type).toUpperCase()}`;
  if (d.comment) return `"${d.comment}"`;
  if (d.age) return `Usia dari dokumen: ${d.age} th`;
  if (d.viewer) return `Penonton: ${d.viewer}`;
  return '';
};

export const AuditLogPanel: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      setEntries(await fetchAuditLog());
    } catch (err) {
      setError(err instanceof Error ? err.message : String((err as any)?.message ?? err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">300 aktivitas terakhir. Dicatat otomatis oleh database dan tidak bisa diubah.</p>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer" title="Muat ulang">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-slate-400">Memuat...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-slate-500 p-6 text-center">Belum ada aktivitas.</p>
      ) : (
        <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/30">
          {entries.map((e) => {
            const { action, target } = describe(e);
            const detail = detailText(e);
            return (
              <div key={e.id} className="px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                <span className="text-slate-500 shrink-0 sm:w-36">{e.createdAt}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white">{e.actorName}</span>{' '}
                  <span className="text-slate-300">{action}</span>{' '}
                  <span className="font-semibold text-red-300">{target}</span>
                  {detail && <div className="text-slate-500 truncate">{detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
