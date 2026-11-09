import React from 'react';
import { Sparkles, MessageCircle, Radio, ShieldCheck, Camera, HeartHandshake, Send } from 'lucide-react';
import { HERO_BG_IMAGE } from '../data/initialTalents';
import { SiteSettings } from '../types/talent';

interface HeroProps {
  onExploreCatalog: () => void;
  onFilterLive: () => void;
  liveCount: number;
  siteSettings: SiteSettings;
}

export const Hero: React.FC<HeroProps> = ({
  onExploreCatalog,
  onFilterLive,
  liveCount,
  siteSettings
}) => {
  return (
    <section id="top" className="relative overflow-hidden pt-6 pb-16 md:pt-14 md:pb-24 border-b border-red-950/40">
      {/* Background with measured luxury crimson dark scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src={HERO_BG_IMAGE}
          alt="PARADOX VIP Lounge"
          className="w-full h-full object-cover object-center opacity-30 filter brightness-60 scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080D]/90 via-[#07080D]/95 to-[#08090E]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(220,38,38,0.18),transparent_65%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Logo badge hero showcase */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-red-500/80 shadow-2xl shadow-red-600/40 group p-1 bg-black">
              <img
                src={siteSettings.logoUrl}
                alt={siteSettings.brandName}
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest text-red-400 uppercase">
              <Sparkles className="w-3.5 h-3.5 text-red-500" />
              <span>{siteSettings.heroAnnouncement}</span>
            </div>
          </div>

          {/* Main Headline with balanced wrapping */}
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.12]" style={{ textWrap: 'balance' }}>
            {siteSettings.brandName}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-500 to-amber-300">
              VIP TALENT
            </span>
            <span className="block text-xl sm:text-3xl font-bold text-slate-200 mt-2 font-sans">
              Koneksi Langsung ke Telegram Pribadi
            </span>
          </h1>

          {/* Value Proposition */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            {siteSettings.heroSubtitle}
          </p>

          {/* Interactive CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onExploreCatalog}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap cursor-pointer"
            >
              Buka Katalog Talent
            </button>
            <button
              onClick={onFilterLive}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Lihat {liveCount} Talent Sedang Live</span>
            </button>
            <a
              href={siteSettings.officialTelegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-semibold text-sm text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Send className="w-4 h-4 text-cyan-400" />
              <span>CS Telegram (@{siteSettings.officialTelegramUsername})</span>
            </a>
          </div>
        </div>

        {/* 4-Item Proof & Guarantee Strip */}
        <div className="mt-14 pt-8 border-t border-red-950/30 grid grid-cols-2 md:grid-cols-4 gap-6 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20 text-cyan-400 shrink-0">
              <MessageCircle className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Direct Telegram</div>
              <div className="text-xs text-slate-400">Chat ke masing-masing talent</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20 text-red-400 shrink-0">
              <Camera className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Multi Media Reel</div>
              <div className="text-xs text-slate-400">Slide foto & video HD asli</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Talent Terverifikasi</div>
              <div className="text-xs text-slate-400">100% identitas asli & nyata</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20 text-violet-400 shrink-0">
              <HeartHandshake className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Privasi Terjamin</div>
              <div className="text-xs text-slate-400">100% rahasia & aman</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
