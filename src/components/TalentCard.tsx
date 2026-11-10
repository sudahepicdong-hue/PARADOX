import { knownServices } from '../lib/services';
import React from 'react';
import { Talent } from '../types/talent';
import { Heart, Star, Send, Radio, Video, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface TalentCardProps {
  talent: Talent;
  onOpenDetail: (talent: Talent) => void;
  onToggleLike: (talentId: string) => void;
  isLiked: boolean;
  onOpenLive?: (talent: Talent) => void;
  brandName?: string;
}

export const TalentCard: React.FC<TalentCardProps> = ({
  talent,
  onOpenDetail,
  onToggleLike,
  isLiked,
  onOpenLive,
  brandName = 'PARADOX'
}) => {
  const primaryMedia = talent.media[0] || {
    url: '/images/talent_model_valerie_1794207018750.jpg',
    type: 'image'
  };

  const hasVideo = talent.media.some((m) => m.type === 'video');

  // Telegram direct contact link with custom message
  const telegramMessage = encodeURIComponent(
    `Halo ${talent.name} (@${talent.telegramUsername}), saya melihat profil dan katalog Anda di ${brandName}. Apakah sedang available untuk konsultasi/booking?`
  );
  const telegramDirectUrl = `https://t.me/${talent.telegramUsername}?text=${telegramMessage}`;

  return (
    <div className="group relative bg-[#0E1017] rounded-2xl border border-white/10 hover:border-red-500/40 transition-all duration-300 flex flex-col overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-red-600/10">
      {/* Media Cover Container with 3:4 portrait ratio */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900 cursor-pointer" onClick={() => onOpenDetail(talent)}>
        <img
          src={primaryMedia.url}
          alt={talent.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Contrast Scrim gradient for legible text overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1017] via-[#0E1017]/20 to-transparent" />

        {/* Top Badges Bar */}
        <div className="absolute top-2 inset-x-2 sm:top-3 sm:inset-x-3 flex items-center justify-between gap-1 z-10 pointer-events-none">
          {/* Live Indicator */}
          {talent.isLive ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenLive) onOpenLive(talent);
                else onOpenDetail(talent);
              }}
              className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-semibold backdrop-blur-md shadow-lg shadow-rose-900/50 transition-colors"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
              <span>LIVE</span>
            </button>
          ) : talent.isOnline ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
              Offline
            </span>
          )}

          {/* Media Count Indicator */}
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 sm:px-2.5 py-1 rounded-full text-[11px] text-slate-200 border border-white/10">
            {hasVideo ? <Video className="w-3 h-3 text-amber-400" /> : <ImageIcon className="w-3 h-3 text-slate-300" />}
            <span className="font-mono">
              {talent.media.length}
              <span className="hidden sm:inline"> Media</span>
            </span>
          </div>
        </div>

        {/* Bottom Floating Identity on Photo */}
        <div className="absolute bottom-2 inset-x-2.5 sm:bottom-3 sm:inset-x-3.5 z-10 pointer-events-none">
          <div className="hidden sm:block text-xs text-red-400 font-mono font-semibold mb-0.5 truncate">
            @{talent.telegramUsername}
          </div>
          <h3 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1 sm:gap-1.5 leading-snug min-w-0">
            <span className="truncate">{talent.name}</span>
            {talent.verified && (
              <span title="Talent Terverifikasi">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
              </span>
            )}
          </h3>
        </div>
      </div>

      {/* Content & Services */}
      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 sm:space-y-4">
        {/* Services Badges (di HP disembunyikan supaya kartu ringkas; lengkap di halaman detail) */}
        {knownServices(talent.services).length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {knownServices(talent.services).slice(0, 3).map((srv, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium text-slate-300 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-md"
              >
                {srv}
              </span>
            ))}
          </div>
        )}

        {/* Short bio preview */}
        <p className="hidden sm:block text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {talent.bio}
        </p>

        {/* Social Metrics Bar: Likes & Rating */}
        <div className="flex items-center justify-between text-xs text-slate-300 sm:pt-1 sm:border-t border-white/5">
          <button
            onClick={() => onToggleLike(talent.id)}
            className={`flex items-center gap-1.5 transition-colors ${
              isLiked ? 'text-rose-400' : 'text-slate-400 hover:text-rose-400'
            }`}
            title="Sukai Talent ini"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span className="font-mono tabular-nums font-medium">{talent.likesCount}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <span className="font-semibold text-slate-100 font-mono tabular-nums">
              {talent.ratingAverage.toFixed(1)}
            </span>
            <span className="text-slate-500 text-[11px]">
              ({talent.reviewsCount}<span className="hidden sm:inline"> ulasan</span>)
            </span>
          </div>
        </div>

        {/* Action Buttons: Direct Telegram & Detail Modal */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 sm:pt-1">
          <button
            onClick={() => onOpenDetail(talent)}
            className="py-2.5 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-center"
          >
            <span className="sm:hidden">Detail</span>
            <span className="hidden sm:inline">Lihat Media</span>
          </button>

          <a
            href={telegramDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-md shadow-red-600/30 transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer"
            title={`Hubungi ${talent.name} langsung via Telegram`}
          >
            <Send className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="sm:hidden">Chat</span>
            <span className="hidden sm:inline">Chat Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
};
