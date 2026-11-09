import React, { useEffect, useState } from 'react';
import { fetchTalentLoginOptions, talentLoginEmail } from '../lib/db';
import { UserAccount } from '../types/talent';
import { X, User, Lock, Mail, Shield, Sparkles, Radio } from 'lucide-react';
import { signIn, signUp, requestPasswordReset } from '../lib/auth';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
}

// Semua login lewat Supabase Auth (email + kata sandi).
// Role (user / talent / admin) diambil dari tabel public.profiles, bukan dari form.
export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLoginSuccess }) => {
  const [activeRole, setActiveRole] = useState<'user' | 'talent' | 'admin'>('user');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgot, setIsForgot] = useState(false); // mode "Lupa kata sandi"

  const isRegister = activeRole === 'user' && mode === 'register' && !isForgot;

  // Daftar talent yang sudah dibuatkan login oleh admin
  const [talentOptions, setTalentOptions] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedTalentId, setSelectedTalentId] = useState('');

  useEffect(() => {
    if (activeRole !== 'talent' || talentOptions) return;
    fetchTalentLoginOptions()
      .then((list) => {
        setTalentOptions(list);
        if (list[0]) setSelectedTalentId(list[0].id);
      })
      .catch(() => {
        setTalentOptions([]);
        setErrorMessage('Gagal memuat daftar talent. Coba lagi.');
      });
  }, [activeRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (activeRole === 'talent' && !selectedTalentId) {
      setErrorMessage('Pilih nama talent Anda dulu.');
      return;
    }
    const email = activeRole === 'talent' ? talentLoginEmail(selectedTalentId) : identifier.trim().toLowerCase();
    setIsLoading(true);
    try {
      if (isForgot) {
        await requestPasswordReset(email);
        setInfoMessage('Jika email terdaftar, link reset kata sandi sudah dikirim. Cek inbox / folder spam Anda.');
        return;
      }

      if (activeRole === 'user' && mode === 'register') {
        if (!name.trim()) {
          setErrorMessage('Silakan masukkan nama lengkap atau alias Anda.');
          return;
        }
        const { account, needsConfirmation } = await signUp(name.trim(), email, password);
        if (needsConfirmation || !account) {
          setInfoMessage('Pendaftaran berhasil! Cek email Anda dan klik link konfirmasi, lalu masuk.');
          setMode('login');
          setPassword('');
          return;
        }
        onLoginSuccess(account);
        onClose();
        return;
      }

      const account = await signIn(email, password, activeRole);
      onLoginSuccess(account);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.';
      setErrorMessage(activeRole === 'talent' && msg === 'Email atau kata sandi salah.' ? 'Password salah.' : msg);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = (role: 'user' | 'talent' | 'admin') => {
    setActiveRole(role);
    setErrorMessage('');
    setInfoMessage('');
  };

  const toggleForgot = (value: boolean) => {
    setIsForgot(value);
    setErrorMessage('');
    setInfoMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-md bg-[#090A10] border border-red-500/40 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 mb-2">
            {activeRole === 'talent' ? (
              <Radio className="w-6 h-6 animate-pulse" />
            ) : activeRole === 'admin' ? (
              <Shield className="w-6 h-6" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>
          <h3 className="font-display text-2xl font-bold text-white">
            {isForgot
              ? 'Lupa Kata Sandi'
              : activeRole === 'talent'
              ? 'Login Khusus Talent Host'
              : activeRole === 'admin'
              ? 'Admin Studio Login'
              : mode === 'login'
              ? 'Masuk Member VIP'
              : 'Daftar Akun Baru'}
          </h3>
          <p className="text-xs text-slate-400">
            {isForgot
              ? 'Masukkan email akun Anda. Kami akan mengirim link untuk membuat kata sandi baru.'
              : activeRole === 'talent'
              ? 'Akses studio live streaming dan kelola profil Anda sendiri.'
              : activeRole === 'admin'
              ? 'Kelola katalog talent, edit media, dan atur seluruh pengaturan website'
              : 'Simpan talent favorit, beri ulasan dan rating, serta akses VIP exclusive'}
          </p>
        </div>

        {/* 3-Role Switcher Tabs */}
        {!isForgot && (
        <div className="grid grid-cols-3 p-1 bg-black/60 rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => switchRole('user')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeRole === 'user' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Member VIP
          </button>
          <button
            type="button"
            onClick={() => switchRole('talent')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeRole === 'talent' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3 h-3 text-red-400" />
            <span>Talent</span>
          </button>
          <button
            type="button"
            onClick={() => switchRole('admin')}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeRole === 'admin' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Admin</span>
          </button>
        </div>
        )}

        {/* User Login/Register Toggle (only when in user mode) */}
        {activeRole === 'user' && !isForgot && (
          <div className="grid grid-cols-2 p-1 bg-black/40 rounded-lg border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); setInfoMessage(''); }}
              className={`py-1.5 rounded font-medium transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(''); setInfoMessage(''); }}
              className={`py-1.5 rounded font-medium transition-all cursor-pointer ${
                mode === 'register' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Daftar Baru
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Nama Lengkap / Alias</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: David W."
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {activeRole === 'talent' && !isForgot ? (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Pilih Nama Talent Anda</label>
              {talentOptions === null ? (
                <p className="text-xs text-slate-400 py-2.5">Memuat daftar talent...</p>
              ) : talentOptions.length === 0 ? (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                  Belum ada talent yang dibuatkan login. Minta admin membuatkan password untuk Anda.
                </p>
              ) : (
                <div className="relative">
                  <Radio className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
                  <select
                    value={selectedTalentId}
                    onChange={(e) => setSelectedTalentId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/70 border border-red-500/40 text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {talentOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                {activeRole === 'admin' ? 'Email Admin' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {!isForgot && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-300 font-medium">
                  {activeRole === 'talent' ? 'Password Talent' : 'Kata Sandi'}
                </label>
                {activeRole === 'talent' ? (
                  <span className="text-[11px] text-slate-500">Lupa? Minta admin buatkan password baru.</span>
                ) : (
                  !isRegister && (
                    <button
                      type="button"
                      onClick={() => toggleForgot(true)}
                      className="text-[11px] text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                    >
                      Lupa kata sandi?
                    </button>
                  )
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
              {errorMessage}
            </p>
          )}

          {infoMessage && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {isLoading
              ? 'Memproses...'
              : isForgot
              ? 'Kirim Link Reset'
              : activeRole === 'talent'
              ? 'Masuk ke Studio Live Talent'
              : activeRole === 'admin'
              ? 'Masuk ke Admin Studio'
              : mode === 'login'
              ? 'Masuk Sekarang'
              : 'Daftar Akun VIP'}
          </button>

          {isForgot && (
            <button
              type="button"
              onClick={() => toggleForgot(false)}
              className="w-full text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ← Kembali ke halaman masuk
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
