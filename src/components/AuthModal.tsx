import React, { useState } from 'react';
import { UserAccount, Talent } from '../types/talent';
import { X, User, Lock, Mail, Shield, Sparkles, Radio, Check } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  talents: Talent[];
}

// Hash SHA-256 kredensial diambil dari Environment Variables (diatur di Sevalla / file .env lokal).
// Kalau variabel belum diisi, login admin & talent otomatis ditolak.
const ADMIN_USERNAME_HASH = (import.meta.env.VITE_ADMIN_USERNAME_HASH ?? '').trim().toLowerCase();
const ADMIN_PASSWORD_HASH = (import.meta.env.VITE_ADMIN_PASSWORD_HASH ?? '').trim().toLowerCase();
const TALENT_PASSWORD_HASH = (import.meta.env.VITE_TALENT_PASSWORD_HASH ?? '').trim().toLowerCase();

const sha256 = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLoginSuccess, talents }) => {
  // Roles: 'user' | 'talent' | 'admin'
  const [activeRole, setActiveRole] = useState<'user' | 'talent' | 'admin'>('user');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTalentId, setSelectedTalentId] = useState<string>(talents[0]?.id || '');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (activeRole === 'admin') {
      // Admin authentication
      const [userHash, passHash] = await Promise.all([
        sha256(identifier.trim().toLowerCase()),
        sha256(password),
      ]);
      if (userHash !== ADMIN_USERNAME_HASH || passHash !== ADMIN_PASSWORD_HASH) {
        setErrorMessage('Username atau kata sandi admin salah.');
        return;
      }
      const adminUser: UserAccount = {
        id: 'admin-official',
        name: 'Official Admin PARADOX',
        emailOrPhone: 'paradox',
        role: 'admin',
        likedTalentIds: []
      };
      onLoginSuccess(adminUser);
      onClose();
      return;
    }

    if (activeRole === 'talent') {
      // Talent authentication
      if ((await sha256(password)) !== TALENT_PASSWORD_HASH) {
        setErrorMessage('Kata sandi talent salah.');
        return;
      }
      const talentObj = talents.find((t) => t.id === selectedTalentId) || talents[0];
      const talentUser: UserAccount = {
        id: `talent-user-${talentObj.id}`,
        name: talentObj.name,
        emailOrPhone: `@${talentObj.telegramUsername}`,
        role: 'talent',
        talentId: talentObj.id,
        likedTalentIds: []
      };
      onLoginSuccess(talentUser);
      onClose();
      return;
    }

    // Standard User / Visitor
    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Silakan masukkan nama lengkap atau alias Anda.');
        return;
      }
      const newUser: UserAccount = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        emailOrPhone: identifier.trim(),
        role: 'user',
        likedTalentIds: []
      };
      onLoginSuccess(newUser);
      onClose();
    } else {
      const standardUser: UserAccount = {
        id: `user-${Date.now()}`,
        name: name.trim() || identifier.split('@')[0] || 'VIP Member',
        emailOrPhone: identifier.trim(),
        role: 'user',
        likedTalentIds: []
      };
      onLoginSuccess(standardUser);
      onClose();
    }
  };

  // Demo instan hanya untuk Member VIP. Admin & Talent wajib login dengan kata sandi.
  const handleQuickDemoLogin = () => {
    onLoginSuccess({
      id: 'user-demo-1',
      name: 'Reza Hendra (VIP Client)',
      emailOrPhone: 'reza@vipclub.id',
      role: 'user',
      likedTalentIds: ['talent-2']
    });
    onClose();
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
            {activeRole === 'talent'
              ? 'Login Khusus Talent Host'
              : activeRole === 'admin'
              ? 'Admin Studio Login'
              : mode === 'login'
              ? 'Masuk Member VIP'
              : 'Daftar Akun Baru'}
          </h3>
          <p className="text-xs text-slate-400">
            {activeRole === 'talent'
              ? 'Akses eksklusif untuk siaran live streaming kamera dan chat penonton. Tidak dapat mengubah data website.'
              : activeRole === 'admin'
              ? 'Kelola katalog talent, edit media, dan atur seluruh pengaturan website'
              : 'Simpan talent favorit, beri ulasan dan rating, serta akses VIP exclusive'}
          </p>
        </div>

        {/* 3-Role Switcher Tabs */}
        <div className="grid grid-cols-3 p-1 bg-black/60 rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => { setActiveRole('user'); setErrorMessage(''); }}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeRole === 'user' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Member VIP
          </button>
          <button
            type="button"
            onClick={() => { setActiveRole('talent'); setErrorMessage(''); }}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeRole === 'talent' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3 h-3 text-red-400" />
            <span>Talent</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveRole('admin'); setErrorMessage(''); }}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeRole === 'admin' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Admin</span>
          </button>
        </div>

        {/* User Login/Register Toggle (only when in user mode) */}
        {activeRole === 'user' && (
          <div className="grid grid-cols-2 p-1 bg-black/40 rounded-lg border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); }}
              className={`py-1.5 rounded font-medium transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(''); }}
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
          {/* If Talent Role: Select Talent Profile */}
          {activeRole === 'talent' && (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-semibold">
                Pilih Akun Profil Talent Anda:
              </label>
              <select
                value={selectedTalentId}
                onChange={(e) => setSelectedTalentId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-red-500/40 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer font-medium"
              >
                {talents.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (@{t.telegramUsername})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeRole === 'user' && mode === 'register' && (
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

          {activeRole !== 'talent' && (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                {activeRole === 'admin' ? 'Username Admin' : 'Email atau Nomor WhatsApp'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activeRole === 'admin' ? 'Masukkan username admin' : 'nama@email.com / 0812xxxx'}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">
              {activeRole === 'talent' ? 'PIN / Kata Sandi Talent' : 'Kata Sandi'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            {activeRole === 'talent'
              ? 'Masuk ke Studio Live Talent'
              : activeRole === 'admin'
              ? 'Masuk ke Admin Studio'
              : mode === 'login'
              ? 'Masuk Sekarang'
              : 'Daftar Akun VIP'}
          </button>
        </form>

        {/* Quick Demo Login (Member VIP only) */}
        {activeRole === 'user' && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="text-[11px] text-slate-400 text-center font-medium">
              Uji coba instan tanpa ketik password:
            </div>
            <button
              onClick={handleQuickDemoLogin}
              className="w-full py-2 px-2 rounded-lg text-[11px] font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer text-center"
            >
              Demo Member VIP
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
