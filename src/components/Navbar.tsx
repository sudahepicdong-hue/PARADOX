import React, { useState } from 'react';
import { Shield, User, LogOut, Menu, X, Radio, Send, UserCog } from 'lucide-react';
import { UserAccount, SiteSettings } from '../types/talent';

interface NavbarProps {
  currentUser: UserAccount | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenBroadcast: () => void;
  onOpenProfile: () => void;
  onOpenAccount: () => void;
  activeFilter: string;
  onSelectCategory: (cat: string) => void;
  liveCount: number;
  siteSettings: SiteSettings;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenBroadcast,
  onOpenProfile,
  onOpenAccount,
  activeFilter,
  onSelectCategory,
  liveCount,
  siteSettings
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#07080D]/95 backdrop-blur-md border-b border-red-500/20 transition-all shadow-xl shadow-black/50 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Brand Wordmark with Reference Logo */}
        <a
          href="#top"
          onClick={(e) => { e.preventDefault(); scrollToSection('top'); }}
          className="flex items-center gap-2 sm:gap-3 group whitespace-nowrap min-w-0 text-decoration-none"
        >
          {/* Custom Logo Image provided by user */}
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-red-500/60 shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform bg-black shrink-0">
            <img
              src={siteSettings.logoUrl}
              alt={siteSettings.brandName}
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="flex flex-col min-w-0">
            <span className="font-display font-extrabold text-xl sm:text-2xl tracking-wider sm:tracking-widest truncate text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-red-500 drop-shadow-sm">
              {siteSettings.brandName}
            </span>
            <span className="hidden sm:block text-[10px] tracking-widest text-red-400/90 uppercase font-semibold -mt-0.5">
              {siteSettings.brandTagline}
            </span>
          </div>
        </a>

        {/* Zone 2: Single-line nav links (4-5 items) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a
            href="#katalog"
            onClick={(e) => { e.preventDefault(); scrollToSection('katalog'); }}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-red-400 ${
              activeFilter !== 'live' ? 'text-red-400 font-semibold' : ''
            }`}
          >
            Katalog Talent
          </a>
          <button
            onClick={() => {
              onSelectCategory('live');
              scrollToSection('katalog');
            }}
            className="flex items-center gap-2 hover:text-rose-400 transition-colors whitespace-nowrap shrink-0 text-slate-300 cursor-pointer"
          >
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Live Stream</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {liveCount} Aktif
            </span>
          </button>
          <a
            href="#booking-guide"
            onClick={(e) => { e.preventDefault(); scrollToSection('booking-guide'); }}
            className="transition-colors whitespace-nowrap shrink-0 hover:text-red-300"
          >
            Panduan Telegram
          </a>
          <a
            href={siteSettings.officialTelegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors whitespace-nowrap shrink-0 text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>CS Official (@{siteSettings.officialTelegramUsername})</span>
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action Area */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* Jika Login sebagai Talent Host */}
              {currentUser.role === 'talent' && (
                <button
                  onClick={onOpenProfile}
                  className="hidden sm:flex px-3.5 py-2 text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Kelola profil, foto, dan status Anda"
                >
                  <UserCog className="w-3.5 h-3.5" />
                  <span>Profil Saya</span>
                </button>
              )}
              {currentUser.role === 'talent' && (
                <button
                  onClick={onOpenBroadcast}
                  className="hidden sm:flex px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 border border-red-500 rounded-xl transition-all shadow-md shadow-red-600/30 items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Buka Studio Siaran Live Kamera Anda"
                >
                  <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>Studio Live Saya</span>
                </button>
              )}

              {/* Jika Login sebagai Admin (Go Live + Admin Studio) */}
              {currentUser.role === 'admin' && (
                <>
                  <button
                    onClick={onOpenBroadcast}
                    className="hidden sm:flex px-3.5 py-2 text-xs font-bold text-white bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 rounded-xl transition-all shadow-sm items-center gap-1.5 whitespace-nowrap cursor-pointer hover:border-red-400"
                    title="Buka Studio Siaran Langsung (Khusus Admin/Talent)"
                  >
                    <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    <span>Go Live Studio</span>
                  </button>

                  <button
                    onClick={onOpenAdmin}
                    className="p-2.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 rounded-xl transition-all shadow-md shadow-red-600/30 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    title="Buka Admin Studio Kelola Semua Data & Telegram"
                    aria-label="Admin Studio"
                  >
                    <Shield className="w-3.5 h-3.5 text-white" />
                    <span className="hidden sm:inline">Admin Studio</span>
                  </button>
                </>
              )}

              <button
                onClick={onOpenAccount}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
                title="Akun Saya"
              >
                <span className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-red-400 uppercase tracking-wider font-mono">
                    {currentUser.role === 'admin'
                      ? 'Admin Official'
                      : currentUser.role === 'talent'
                      ? 'Talent Host'
                      : 'VIP Member'}
                  </span>
                </span>
                <User className="w-4 h-4 text-slate-300 sm:hidden" />
              </button>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                aria-label="Masuk / Daftar"
                className="px-3 sm:px-4 py-2 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-red-500/30 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-red-400" />
                <span className="sm:hidden">Masuk</span>
                <span className="hidden sm:inline">Masuk / Daftar</span>
              </button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 -mr-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-red-900/30 bg-[#07080D] px-4 pt-3 pb-6 space-y-3">
          {currentUser?.role === 'talent' && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBroadcast();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 border border-red-500 text-sm text-white font-bold flex items-center justify-between cursor-pointer shadow-lg shadow-red-950/50"
            >
              <span className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-white animate-pulse" />
                Studio Live Saya (Kamera & Chat)
              </span>
              <span className="text-[11px] bg-black/40 text-red-200 px-2 py-0.5 rounded-full font-mono">Talent Host</span>
            </button>
          )}

          {currentUser?.role === 'talent' && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenProfile();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white font-bold flex items-center gap-2 cursor-pointer"
            >
              <UserCog className="w-4 h-4" />
              Profil Saya (Edit, Foto, Sembunyikan)
            </button>
          )}

          {currentUser?.role === 'admin' && (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBroadcast();
                }}
                className="w-full text-left py-2.5 px-3 rounded-xl bg-red-600/20 border border-red-500/30 text-sm text-red-300 font-bold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                  Studio Siaran Talent (Go Live)
                </span>
                <span className="text-[11px] bg-red-600 text-white px-2 py-0.5 rounded-full">Admin Studio</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAdmin();
                }}
                className="w-full text-left py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-sm text-white font-bold flex items-center justify-between cursor-pointer shadow-md shadow-red-950/50"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white" />
                  Admin Studio (Kelola Semua)
                </span>
                <span className="text-[11px] bg-black/40 text-red-100 px-2 py-0.5 rounded-full font-mono">Master</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              onSelectCategory('all');
              scrollToSection('katalog');
            }}
            className="w-full text-left py-2 text-sm text-slate-200 hover:text-red-400 flex items-center justify-between cursor-pointer"
          >
            <span>Semua Katalog Talent</span>
          </button>
          <button
            onClick={() => {
              onSelectCategory('live');
              scrollToSection('katalog');
            }}
            className="w-full text-left py-2 text-sm text-rose-400 flex items-center justify-between font-medium cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Radio className="w-4 h-4 animate-pulse" />
              Sedang Live Sekarang
            </span>
            <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono">
              {liveCount} Aktif
            </span>
          </button>
          <button
            onClick={() => scrollToSection('booking-guide')}
            className="w-full text-left py-2 text-sm text-slate-200 hover:text-red-400 cursor-pointer"
          >
            Panduan Booking Telegram
          </button>
          <a
            href={siteSettings.officialTelegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2 text-sm text-cyan-400 font-medium"
          >
            Customer Service Telegram Official (@{siteSettings.officialTelegramUsername})
          </a>
        </div>
      )}
    </header>
  );
};
