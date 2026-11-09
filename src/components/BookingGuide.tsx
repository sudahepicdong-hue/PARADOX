import React from 'react';
import { Send, Shield, CheckCircle2 } from 'lucide-react';
import { SiteSettings } from '../types/talent';

interface BookingGuideProps {
  siteSettings: SiteSettings;
}

export const BookingGuide: React.FC<BookingGuideProps> = ({ siteSettings }) => {
  return (
    <section id="booking-guide" className="py-16 border-t border-red-950/30 bg-[#07080D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-semibold text-red-500 uppercase tracking-widest">
            Alur Pemesanan Cepat & Rahasia
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
            Cara Menghubungi & Booking via Telegram {siteSettings.brandName}
          </h2>
          <p className="text-sm text-slate-400">
            Tanpa pendaftaran berbelit-belit. Anda langsung terhubung ke Telegram masing-masing talent secara privat.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#0C0E14] border border-white/10 space-y-4 relative group hover:border-red-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-lg font-mono">
              01
            </div>
            <h3 className="font-display font-bold text-lg text-white">Pilih Talent di Katalog</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cek detail profil, slide foto & video reel asli, layanan eksklusif, serta testimoni member terpercaya.
            </p>
            <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />
              <span>Semua profil 100% foto asli terverifikasi</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#0C0E14] border border-cyan-500/20 space-y-4 relative group hover:border-cyan-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-lg font-mono">
              02
            </div>
            <h3 className="font-display font-bold text-lg text-white">Klik Chat Telegram Langsung</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tekan tombol "Chat Telegram" di kartu profil. Browser otomatis membuka Telegram talent dengan draft pesan ketersediaan jadwal yang telah terformat rapi.
            </p>
            <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Komunikasi langsung tanpa bot perantara</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#0C0E14] border border-white/10 space-y-4 relative group hover:border-red-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center font-bold text-lg font-mono">
              03
            </div>
            <h3 className="font-display font-bold text-lg text-white">Konfirmasi Jadwal & Privasi</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sepakati waktu, lokasi (dinner, lounge, party), serta durasi. Identitas Anda dijamin aman dan terjaga kerahasiaannya dengan standar VIP {siteSettings.brandName}.
            </p>
            <div className="pt-2 text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
              <span>Dukungan CS Agency 24/7 selalu siap</span>
            </div>
          </div>
        </div>

        {/* Agency CS Contact Box */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#0E1017] to-cyan-950/40 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-red-400">
              <Shield className="w-4 h-4" />
              <span>Pusat Bantuan & Layanan CS Resmi {siteSettings.brandName}</span>
            </div>
            <h4 className="font-display text-lg sm:text-xl font-bold text-white">
              {siteSettings.supportHeading}
            </h4>
            <p className="text-xs text-slate-400">
              {siteSettings.supportSubtext}
            </p>
          </div>

          <a
            href={siteSettings.officialTelegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Hubungi CS Telegram @{siteSettings.officialTelegramUsername}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
