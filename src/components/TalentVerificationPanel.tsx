import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, ShieldAlert, FileText, Eye, Trash2, Upload, KeyRound, EyeOff } from 'lucide-react';
import { Talent, TalentDocument } from '../types/talent';
import * as db from '../lib/db';

interface TalentVerificationPanelProps {
  talent: Talent;
  onBack: () => void;
  onChanged: (talentId: string) => Promise<void>; // muat ulang data talent setelah ada perubahan
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

const DOC_TYPES: Record<TalentDocument['docType'], string> = {
  ktp: 'KTP',
  paspor: 'Paspor',
  sim: 'SIM',
  lainnya: 'Lainnya'
};

const ageFrom = (birthDate: string) => {
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
};

export const TalentVerificationPanel: React.FC<TalentVerificationPanelProps> = ({ talent, onBack, onChanged }) => {
  const [docs, setDocs] = useState<TalentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<TalentDocument['docType']>('ktp');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [d, email] = await Promise.all([db.fetchDocuments(talent.id), db.fetchTalentAccountEmail(talent.id)]);
      setDocs(d);
      setAccountEmail(email);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [talent.id]);

  const run = async (key: string, action: () => Promise<void>, okText: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'ok', text: okText });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !birthDate) return;
    run(
      'upload',
      async () => {
        await db.uploadDocument(talent.id, docFile, docType, birthDate);
        setDocFile(null);
        setBirthDate('');
        await load();
      },
      'Dokumen tersimpan.'
    );
  };

  const handleViewDoc = async (doc: TalentDocument) => {
    try {
      const url = await db.getDocumentUrl(doc.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    }
  };

  const handleDeleteDoc = (doc: TalentDocument) => {
    if (!confirm('Hapus dokumen ini?')) return;
    run(`del-${doc.id}`, async () => {
      await db.deleteDocument(doc);
      await load();
    }, 'Dokumen dihapus.');
  };

  const youngestBirth = docs.reduce<string | null>((max, d) => (!max || d.birthDate > max ? d.birthDate : max), null);
  const docAge = youngestBirth ? ageFrom(youngestBirth) : null;
  const isVerified = Boolean(talent.idVerifiedAt);

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500';

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke daftar talent
      </button>

      <div className="flex items-center gap-3">
        <img
          src={talent.media[0]?.url}
          alt={talent.name}
          className="w-14 h-14 rounded-lg object-cover bg-slate-900 border border-white/10"
        />
        <div>
          <h4 className="font-bold text-white">{talent.name}</h4>
          <div className="text-xs text-slate-400">ID: {talent.id}</div>
        </div>
      </div>

      {/* Status */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 ${
          isVerified ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        {isVerified ? (
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
        ) : (
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
        )}
        <div className="flex-1 text-xs">
          <div className={`font-bold ${isVerified ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isVerified ? 'Terverifikasi 18+' : 'Belum diverifikasi — profil TIDAK tampil di katalog'}
          </div>
          <div className="text-slate-400">
            {talent.isActive === false ? 'Profil sedang disembunyikan.' : 'Profil aktif.'}
            {docAge !== null && ` Usia menurut dokumen: ${docAge} tahun.`}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              run('active', async () => {
                await db.setTalentActive(talent.id, talent.isActive === false);
                await onChanged(talent.id);
              }, talent.isActive === false ? 'Profil ditampilkan.' : 'Profil disembunyikan.')
            }
            disabled={busy !== null}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {talent.isActive === false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {talent.isActive === false ? 'Tampilkan' : 'Sembunyikan'}
          </button>
          {isVerified ? (
            <button
              onClick={() =>
                run('verify', async () => {
                  await db.setTalentVerification(talent.id, false);
                  await onChanged(talent.id);
                }, 'Verifikasi dicabut. Profil disembunyikan dari katalog.')
              }
              disabled={busy !== null}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-600 text-white cursor-pointer disabled:opacity-50"
            >
              Cabut Verifikasi
            </button>
          ) : (
            <button
              onClick={() =>
                run('verify', async () => {
                  await db.setTalentVerification(talent.id, true);
                  await onChanged(talent.id);
                }, 'Talent terverifikasi dan sekarang tampil di katalog.')
              }
              disabled={busy !== null || docs.length === 0 || (docAge !== null && docAge < 18)}
              title={docs.length === 0 ? 'Upload dokumen identitas dulu' : undefined}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Verifikasi
            </button>
          )}
        </div>
      </div>

      {docAge !== null && docAge < 18 && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-semibold">
          Dokumen menunjukkan usia di bawah 18 tahun. Talent ini tidak boleh ditampilkan.
        </div>
      )}

      {message && (
        <p
          className={`text-xs p-2.5 rounded-lg border ${
            message.type === 'ok'
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
              : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Dokumen identitas */}
      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-4">
        <div>
          <h5 className="text-sm font-bold text-white">Dokumen Identitas (privat)</h5>
          <p className="text-[11px] text-slate-400">
            Hanya admin yang bisa melihat. Tanggal lahir wajib sesuai dokumen — usia di profil otomatis diambil dari sini.
          </p>
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-400">Memuat...</p>
        ) : docs.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada dokumen.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1">
                  <div className="text-white font-semibold">{DOC_TYPES[d.docType]}</div>
                  <div className="text-slate-400">
                    Lahir {d.birthDate} ({ageFrom(d.birthDate)} th) · diupload {d.createdAt}
                  </div>
                </div>
                <button onClick={() => handleViewDoc(d)} className="p-1.5 rounded hover:bg-white/10 text-slate-300 cursor-pointer" title="Lihat">
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteDoc(d)}
                  disabled={busy !== null}
                  className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer disabled:opacity-50"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleUploadDoc} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Jenis</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as TalentDocument['docType'])} className={inputClass}>
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Tanggal lahir</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">File (foto / PDF, maks 10 MB)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              className="w-full text-[11px] text-slate-300 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-white/10 file:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null || !docFile || !birthDate}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {busy === 'upload' ? 'Mengupload...' : 'Simpan Dokumen'}
          </button>
        </form>
      </div>

      {/* Akun login talent */}
      <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
        <div>
          <h5 className="text-sm font-bold text-white">Login Talent</h5>
          <p className="text-[11px] text-slate-400">
            Buat password untuk talent ini, lalu berikan ke talent-nya. Talent login di tab "Talent": pilih namanya dari
            daftar, masukkan password, lalu bisa siaran live & mengelola profilnya sendiri.
          </p>
        </div>
        <div className="text-xs text-slate-300">
          Status:{' '}
          {accountEmail ? (
            <span className="text-emerald-300 font-semibold">
              {accountEmail.endsWith(`@${db.TALENT_EMAIL_DOMAIN}`) ? 'Sudah punya login' : `Terhubung ke akun ${accountEmail}`}
            </span>
          ) : (
            <span className="text-amber-300 font-semibold">Belum punya login</span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={accountEmail ? 'Password baru (min. 6 karakter)' : 'Buat password (min. 6 karakter)'}
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
          <button
            onClick={() =>
              run('password', async () => {
                await db.setTalentPassword(talent.id, newPassword);
                setNewPassword('');
                await load();
              }, accountEmail ? 'Password talent sudah diganti.' : 'Login talent berhasil dibuat. Berikan password-nya ke talent.')
            }
            disabled={busy !== null || newPassword.length < 6}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {busy === 'password' ? 'Menyimpan...' : accountEmail ? 'Ganti Password' : 'Buat Login'}
          </button>
        </div>
        {accountEmail && (
          <button
            onClick={() => {
              if (!confirm('Cabut akses login talent ini? Talent tidak bisa login lagi sampai dibuatkan password baru.')) return;
              run('remove-login', async () => {
                await db.removeTalentLogin(talent.id);
                await load();
              }, 'Akses login talent dicabut.');
            }}
            disabled={busy !== null}
            className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer disabled:opacity-50"
          >
            Cabut akses login
          </button>
        )}
      </div>
    </div>
  );
};
