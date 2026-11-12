import React from 'react';
import { Send, ShieldAlert } from 'lucide-react';
import { SiteSettings } from '../types/talent';

interface FooterProps {
  siteSettings: SiteSettings;
  onApplyTalent?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ siteSettings, onApplyTalent }) => {
  return (
    <footer className="bg-[#05060A] border-t border-red-950/40 py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand with Logo */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-red-500/60 bg-black shrink-0">
                <img
                  src={siteSettings.logoUrl}
                  alt={siteSettings.brandName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-display font-extrabold text-xl text-white tracking-widest">
                {siteSettings.brandName} <span className="text-red-500 text-sm font-semibold">VIP</span>
              </span>
            </div>
            <p className="text-slate-500 max-w-sm">
              Platform katalog talent premium dan model companion dengan koneksi langsung ke akun Telegram talent dan CS bot @{siteSettings.officialTelegramUsername}.
            </p>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-6 text-slate-300">
            <a href="#katalog" className="hover:text-red-400 transition-colors">Katalog Talent</a>
            <a href="#katalog" className="hover:text-red-400 transition-colors">Status Live</a>
            <a href="#booking-guide" className="hover:text-red-400 transition-colors">Cara Pemesanan</a>
            {onApplyTalent && (
              <button onClick={onApplyTalent} className="hover:text-red-400 transition-colors cursor-pointer">
                Daftar Jadi Talent
              </button>
            )}
            <a 
              href={siteSettings.officialTelegramUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram Official (@{siteSettings.officialTelegramUsername})</span>
            </a>
          </div>
        </div>

        {/* 18+ Notice and Disclaimer */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-red-950/40 flex items-start gap-3 text-[11px] text-slate-500 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>{siteSettings.disclaimerText}</div>
        </div>

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5 text-[11px] text-slate-600">
          <div>
            © {new Date().getFullYear()} {siteSettings.brandName} VIP. All rights reserved. Nightlife Agency & Talent Directory.
          </div>
          <div className="flex items-center gap-4">
            <span>Privasi VIP Dijamin</span>
            <span>·</span>
            <span>Direct Telegram API Link</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
