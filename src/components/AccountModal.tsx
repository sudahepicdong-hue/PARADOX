import React, { useState } from 'react';
import { X, Save, Download, Trash2, UserCircle } from 'lucide-react';
import { UserAccount } from '../types/talent';
import { updateMyName, exportMyData, deleteMyAccount } from '../lib/db';
import { PushToggle } from './PushToggle';

interface AccountModalProps {
  user: UserAccount;
  onClose: () => void;
  onNameChanged: (name: string) => void;
  onDeleted: () => void;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));
const CONFIRM_WORD = 'HAPUS';

// Pengaturan akun member: ganti nama, unduh data pribadi, hapus akun (UU PDP).
export const AccountModal: React.FC<AccountModalProps> = ({ user, onClose, onNameChanged, onDeleted }) => {
  const [name, setName] = useState(user.name);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState<'name' | 'export' | 'delete' | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const run = async (key: 'name' | 'export' | 'delete', action: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    run('name', async () => {
      await updateMyName(user.id, n);
      onNameChanged(n);
      setMessage({ type: 'ok', text: 'Nama berhasil disimpan.' });
    });
  };

  const download = () =>
    run('export', async () => {
      const data = await exportMyData(user.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-akun-saya-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const remove = () =>
    run('delete', async () => {
      await deleteMyAccount();
      onDeleted();
    });

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm text-white focus:outline-none focus:border-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-[#090A10] border border-red-500/30 rounded-2xl shadow-2xl p-6 space-y-6 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle className="w-6 h-6 text-red-400" />
            <h3 className="font-display text-xl font-bold text-white">Akun Saya</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-400">
          Email: <span className="text-slate-200">{user.emailOrPhone}</span>
        </div>

        <form onSubmit={saveName} className="space-y-2">
          <label className="text-xs text-slate-300 font-semibold block">Nama yang tampil di ulasan & chat</label>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={inputClass} />
            <button
              type="submit"
              disabled={busy !== null || name.trim() === user.name}
              className="px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white cursor-pointer disabled:opacity-40"
              title="Simpan"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="text-xs text-slate-300 font-semibold">Notifikasi live di perangkat ini</div>
          <PushToggle />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-slate-300 font-semibold">Data pribadi saya</div>
          <button
            onClick={download}
            disabled={busy !== null}
            className="w-full py-2.5 rounded-lg text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {busy === 'export' ? 'Menyiapkan...' : 'Unduh semua data saya (JSON)'}
          </button>
        </div>

        {user.role === 'admin' ? (
          <p className="text-[11px] text-slate-500">Akun admin tidak bisa dihapus dari website.</p>
        ) : (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
            <div className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Hapus Akun Permanen
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Akun, ulasan, dan like Anda akan dihapus dan tidak bisa dikembalikan.
              {user.role === 'talent' &&
                ' Profil talent Anda TIDAK ikut terhapus — hapus dulu lewat menu "Profil Saya" kalau ingin profil juga hilang.'}{' '}
              Ketik <b className="text-white">{CONFIRM_WORD}</b> untuk konfirmasi.
            </p>
            <div className="flex gap-2">
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={CONFIRM_WORD} className={inputClass} />
              <button
                onClick={remove}
                disabled={confirmText.trim() !== CONFIRM_WORD || busy !== null}
                className="px-4 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                {busy === 'delete' ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
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
      </div>
    </div>
  );
};
