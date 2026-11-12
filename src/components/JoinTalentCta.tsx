import React from 'react';
import { Star, ShieldCheck, Send } from 'lucide-react';

interface JoinTalentCtaProps {
  brandName: string;
  onApply: () => void;
}

// Ajakan "Daftar Jadi Talent" di bagian bawah halaman
export const JoinTalentCta: React.FC<JoinTalentCtaProps> = ({ brandName, onApply }) => (
  <section id="daftar-talent" className="py-14 sm:py-16 border-t border-red-950/40">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-[#0B0C12] to-[#0B0C12] p-6 sm:p-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        <div className="flex-1 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[11px] font-bold text-red-300 uppercase tracking-wider">
            <Star className="w-3.5 h-3.5" />
            Open Recruitment
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">Ingin bergabung jadi talent {brandName}?</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Daftar cukup 2 menit: isi nama, tanggal lahir, username Telegram, dan beberapa foto. Admin kami akan menghubungi
            kamu lewat Telegram untuk langkah selanjutnya.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Khusus 18+
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Foto hanya dilihat admin
            </span>
            <span className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              Dihubungi via Telegram
            </span>
          </div>
        </div>
        <button
          onClick={onApply}
          className="w-full md:w-auto shrink-0 px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all whitespace-nowrap cursor-pointer"
        >
          Daftar Jadi Talent
        </button>
      </div>
    </div>
  </section>
);
