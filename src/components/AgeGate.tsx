import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AgeGateProps {
  brandName: string;
  logoUrl: string;
  onConfirm: () => void;
}

const STORAGE_KEY = 'paradox_age_confirmed';

export const hasConfirmedAge = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const rememberAgeConfirmed = () => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* browser memblokir penyimpanan: tanya lagi di kunjungan berikutnya */
  }
};

// Konfirmasi usia 18+ sebelum pengunjung bisa melihat isi website.
export const AgeGate: React.FC<AgeGateProps> = ({ brandName, logoUrl, onConfirm }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080D]">
    <div className="w-full max-w-md text-center space-y-6">
      <img src={logoUrl} alt={brandName} className="w-24 h-24 mx-auto rounded-full object-cover border-2 border-red-500/60 shadow-lg shadow-red-600/30" />
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold">
          <ShieldAlert className="w-4 h-4" /> KHUSUS DEWASA 18+
        </div>
        {/* Judul utama halaman (dibaca Google): nama & isi website, bukan pertanyaan umur */}
        <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          {brandName} VIP · Katalog Talent Eksklusif
        </h1>
        <h2 className="font-display text-2xl font-bold text-white">Apakah Anda berusia 18 tahun atau lebih?</h2>
        <p className="text-sm text-slate-400">
          Website {brandName} hanya untuk pengunjung berusia 18 tahun ke atas. Dengan masuk, Anda menyatakan sudah cukup umur.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            rememberAgeConfirmed();
            onConfirm();
          }}
          className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 cursor-pointer"
        >
          Ya, saya 18+ — Masuk
        </button>
        <button
          onClick={() => window.location.replace('https://www.google.com')}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
        >
          Tidak, keluar
        </button>
      </div>
      {/* Ringkasan isi website untuk pengunjung & mesin pencari */}
      <p className="text-[11px] leading-relaxed text-slate-500 pt-2 border-t border-white/5">
        {brandName} VIP adalah katalog talent eksklusif dan terverifikasi. Lihat profil lengkap dengan foto & video,
        status online dan siaran live, jadwal, rating serta ulasan pelanggan, lalu hubungi dan booking langsung lewat
        Telegram.
      </p>
    </div>
  </div>
);
