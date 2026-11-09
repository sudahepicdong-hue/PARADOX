import React, { useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { updatePassword } from '../lib/auth';

interface ResetPasswordModalProps {
  onDone: () => void;
}

// Muncul otomatis setelah user membuka link "reset kata sandi" dari email.
export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setIsSaving(true);
    try {
      await updatePassword(password);
      setIsDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kata sandi.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#090A10] border border-red-500/40 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="font-display text-2xl font-bold text-white">Buat Kata Sandi Baru</h3>
          <p className="text-xs text-slate-400">Masukkan kata sandi baru untuk akun Anda.</p>
        </div>

        {isDone ? (
          <div className="space-y-4">
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
              Kata sandi berhasil diganti. Anda sudah masuk dengan kata sandi baru.
            </p>
            <button
              onClick={onDone}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 cursor-pointer"
            >
              Lanjutkan
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi baru (min. 6 karakter)"
                minLength={6}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                minLength={6}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
