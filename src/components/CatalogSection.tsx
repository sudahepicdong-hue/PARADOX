import React, { useState } from 'react';
import { Talent } from '../types/talent';
import { TalentCard } from './TalentCard';
import { Search, Radio, RotateCcw } from 'lucide-react';

interface CatalogSectionProps {
  talents: Talent[];
  onOpenDetail: (talent: Talent) => void;
  onOpenLive: (talent: Talent) => void;
  onToggleLike: (talentId: string) => void;
  likedTalentIds: string[];
  brandName?: string;
}

export const CatalogSection: React.FC<CatalogSectionProps> = ({
  talents,
  onOpenDetail,
  onOpenLive,
  onToggleLike,
  likedTalentIds,
  brandName = 'PARADOX'
}) => {
  const [onlyLive, setOnlyLive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rating' | 'likes' | 'name'>('rating');

  // Filter and Sort logic
  const filteredTalents = talents
    .filter((talent) => {
      // Live filter
      if (onlyLive && !talent.isLive) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = talent.name.toLowerCase().includes(q);
        const matchAlias = talent.alias.toLowerCase().includes(q);
        const matchBio = talent.bio.toLowerCase().includes(q);
        const matchServices = talent.services?.some((s) => s.toLowerCase().includes(q));
        if (!matchName && !matchAlias && !matchBio && !matchServices) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.ratingAverage - a.ratingAverage;
      if (sortBy === 'likes') return b.likesCount - a.likesCount;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const handleResetFilters = () => {
    setOnlyLive(false);
    setSearchQuery('');
    setSortBy('rating');
  };

  return (
    <section id="katalog" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-1">
            Official Directory & Telegram Booking
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Katalog Talent VIP
          </h2>
        </div>
        <p className="text-sm text-slate-400 max-w-md">
          Pilih talent berdasarkan status Live atau cari profil favorit Anda. Klik untuk melihat foto, video, atau langsung hubungi via Telegram.
        </p>
      </div>

      {/* Filter Toolbar Bar */}
      <div className="p-4 rounded-2xl bg-[#0C0E14] border border-white/10 space-y-4 shadow-xl">
        {/* Row: Search, Quick Live Toggle & Sort */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama talent, alias, atau layanan..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Controls: Live Toggle & Sort Dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setOnlyLive(!onlyLive)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all cursor-pointer ${
                onlyLive
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-md shadow-rose-900/30'
                  : 'bg-black/40 text-slate-300 border-white/10 hover:text-white'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${onlyLive ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
              <span>Hanya Sedang Live</span>
            </button>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="rating">Rating Tertinggi</option>
              <option value="likes">Paling Disukai</option>
              <option value="name">Nama (A-Z)</option>
            </select>

            {(onlyLive || searchQuery.trim() || sortBy !== 'rating') && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1.5 transition-colors px-2 py-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div>
          Menampilkan <span className="font-semibold text-white font-mono">{filteredTalents.length}</span> talent terverifikasi
          {onlyLive && ' (Sedang Live)'}
        </div>
      </div>

      {/* Grid of Talent Cards */}
      {filteredTalents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0C0E14] border border-white/10 space-y-4">
          <p className="text-slate-400 text-sm">
            Tidak ada talent yang cocok dengan kriteria filter saat ini.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-5 py-2 text-xs font-semibold text-black bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors"
          >
            Reset Filter Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredTalents.map((talent) => (
            <TalentCard
              key={talent.id}
              talent={talent}
              onOpenDetail={onOpenDetail}
              onOpenLive={onOpenLive}
              onToggleLike={onToggleLike}
              isLiked={likedTalentIds.includes(talent.id)}
              brandName={brandName}
            />
          ))}
        </div>
      )}
    </section>
  );
};
