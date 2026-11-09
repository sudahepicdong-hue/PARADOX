import React, { useEffect, useState } from 'react';
import { FileText, Upload, Trash2, Eye, ShieldCheck } from 'lucide-react';
import { TalentDocument } from '../types/talent';
import { fetchDocuments, uploadDocument, deleteDocument, getDocumentUrl } from '../lib/db';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

const DOC_TYPES: Record<TalentDocument['docType'], string> = {
  ktp: 'KTP',
  paspor: 'Paspor',
  sim: 'SIM',
  lainnya: 'Lainnya'
};

// Talent mengupload dokumen identitasnya sendiri. Admin yang memeriksa & memverifikasi.
export const MyDocumentsSection: React.FC<{ talentId: string; isVerified: boolean }> = ({ talentId, isVerified }) => {
  const [docs, setDocs] = useState<TalentDocument[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<TalentDocument['docType']>('ktp');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = () => fetchDocuments(talentId).then(setDocs).catch((e) => setMessage({ type: 'error', text: errorText(e) }));

  useEffect(() => {
    load();
  }, [talentId]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !birthDate) return;
    setBusy(true);
    setMessage(null);
    try {
      await uploadDocument(talentId, file, docType, birthDate);
      setFile(null);
      setBirthDate('');
      (e.target as HTMLFormElement).reset();
      await load();
      setMessage({ type: 'ok', text: 'Dokumen terkirim. Admin akan memeriksanya.' });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: TalentDocument) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try {
      await deleteDocument(d);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const view = async (d: TalentDocument) => {
    try {
      window.open(await getDocumentUrl(d.storagePath), '_blank', 'noopener,noreferrer');
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500';

  return (
    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
      <div>
        <h5 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Dokumen Identitas
        </h5>
        <p className="text-[11px] text-slate-400">
          Hanya Anda dan admin yang bisa melihat. Wajib 18+. {isVerified ? 'Identitas Anda sudah diverifikasi.' : 'Upload KTP/Paspor/SIM supaya admin bisa memverifikasi profil Anda.'}
        </p>
      </div>

      {docs && docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1">
                <span className="text-white font-semibold">{DOC_TYPES[d.docType]}</span>
                <span className="text-slate-400"> · diupload {d.createdAt}</span>
              </div>
              <button onClick={() => view(d)} className="p-1.5 rounded hover:bg-white/10 text-slate-300 cursor-pointer" title="Lihat">
                <Eye className="w-4 h-4" />
              </button>
              <button onClick={() => remove(d)} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer" title="Hapus">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isVerified && (
        <form onSubmit={upload} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Jenis</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as TalentDocument['docType'])} className={inputClass}>
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Tanggal lahir (sesuai dokumen)</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Foto / PDF (maks 10 MB)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-[11px] text-slate-300 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-white/10 file:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !file || !birthDate}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> {busy ? 'Mengirim...' : 'Kirim'}
          </button>
        </form>
      )}

      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>{message.text}</p>
      )}
    </div>
  );
};
