import React, { useState } from 'react';
import { Talent, Review, UserAccount } from '../types/talent';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Star,
  Heart,
  ShieldCheck,
  MessageSquare,
  Copy,
  Check,
  Video,
  Play,
  Volume2,
  VolumeX,
  Radio,
  Flag,
  Trash2,
  CalendarClock
} from 'lucide-react';
import type { ReportTarget } from './ReportModal';
import type { LiveSchedule } from '../lib/db';
import { scheduleFormat } from './LiveScheduleManager';

import { bookingTopicsFor, knownServices } from '../lib/services';

interface TalentDetailModalProps {
  talent: Talent;
  reviews: Review[];
  onClose: () => void;
  onToggleLike: (talentId: string) => void;
  isLiked: boolean;
  currentUser: UserAccount | null;
  onAddReview: (talentId: string, rating: number, comment: string) => Promise<void>;
  onOpenLive?: (talent: Talent) => void;
  brandName?: string;
  onReport: (target: ReportTarget) => void;
  onDeleteReview: (reviewId: string) => void;
  schedules?: LiveSchedule[];
}

export const TalentDetailModal: React.FC<TalentDetailModalProps> = ({
  talent,
  reviews,
  onClose,
  onToggleLike,
  isLiked,
  currentUser,
  onAddReview,
  onOpenLive,
  brandName = 'PARADOX',
  onReport,
  onDeleteReview,
  schedules = []
}) => {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  // Review form states
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  // Selected booking preset message for Telegram
  // Topik chat = layanan yang dicentang talent ini + CS Alur
  const bookingTopics = bookingTopicsFor(talent.services);
  const [selectedTopic, setSelectedTopic] = useState<string>(bookingTopics[0].label);

  const currentMedia = talent.media[activeMediaIndex] || talent.media[0];

  const getCustomTelegramUrl = () => {
    const topicText = (bookingTopics.find((t) => t.label === selectedTopic) ?? bookingTopics[0]).message;

    const message = encodeURIComponent(
      `Halo ${talent.name} (@${talent.telegramUsername}), saya melihat profil dan katalog Anda di ${brandName}.\n\nSaya ingin ${topicText}. Apakah bisa dibantu?`
    );
    return `https://t.me/${talent.telegramUsername}?text=${message}`;
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${talent.telegramUsername}`);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const handlePrevMedia = () => {
    setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : talent.media.length - 1));
  };

  const handleNextMedia = () => {
    setActiveMediaIndex((prev) => (prev < talent.media.length - 1 ? prev + 1 : 0));
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setReviewError('');
    setIsReviewSaving(true);
    try {
      await onAddReview(talent.id, newRating, newComment.trim());
      setNewComment('');
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 4000);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Gagal mengirim ulasan. Coba lagi.');
    } finally {
      setIsReviewSaving(false);
    }
  };

  const talentReviews = reviews.filter((r) => r.talentId === talent.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-5xl bg-[#0C0E14] sm:border border-amber-500/20 sm:rounded-2xl shadow-2xl overflow-hidden sm:my-auto h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-4 border-b border-white/10 flex items-center justify-between gap-2 bg-[#090A10]/90">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2 min-w-0">
              <span className="truncate">{talent.name}</span>
              <span className="hidden sm:inline text-sm font-normal text-slate-400 font-sans truncate">({talent.alias})</span>
            </h2>
            {talent.verified && (
              <span
                className="text-xs text-amber-400 font-medium flex items-center gap-1 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 rounded border border-amber-500/20 shrink-0"
                title="Terverifikasi"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Terverifikasi</span>
              </span>
            )}
            {!talent.isLive && talent.isOnline && (
              <span className="text-xs text-emerald-300 font-medium flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            )}
            {talent.isLive && (
              <button
                onClick={() => onOpenLive && onOpenLive(talent)}
                className="text-xs text-rose-300 font-medium flex items-center gap-1 bg-rose-500/20 px-2 sm:px-2.5 py-0.5 rounded-full border border-rose-500/40 hover:bg-rose-500/30 transition-colors cursor-pointer shrink-0"
              >
                <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
                <span className="sm:hidden">Live</span>
                <span className="hidden sm:inline">Live Sekarang</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onReport({ targetType: 'talent', talentId: talent.id, label: `Profil ${talent.name}` })}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-300 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Laporkan profil ini"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Laporkan</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Tutup modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-3 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-6 sm:space-y-8">
          {/* Top Split: Media Slider (Left) & Essential Specs + Telegram (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
            {/* Left Column: Media Slider & Reel Viewer (7 cols on lg) */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              {/* Active Media Container with 4:5 aspect ratio */}
              <div className="relative aspect-[4/5] sm:aspect-[4/4.5] w-full rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                {currentMedia.type === 'video' ? (
                  <div className="relative w-full h-full bg-black flex items-center justify-center group">
                    <video
                      key={currentMedia.url}
                      src={currentMedia.url}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted={isVideoMuted}
                      playsInline
                    />
                    {/* Video Audio Control */}
                    <button
                      onClick={() => setIsVideoMuted(!isVideoMuted)}
                      className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 transition-all z-20 backdrop-blur-md"
                      title={isVideoMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
                    >
                      {isVideoMuted ? <VolumeX className="w-4 h-4 text-slate-300" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                    </button>
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/60 text-xs text-amber-300 border border-amber-500/30 backdrop-blur-md z-20">
                      <Video className="w-3.5 h-3.5 text-amber-400" />
                      <span>Video Reel Asli</span>
                    </div>
                  </div>
                ) : (
                  <img
                    key={currentMedia.url}
                    src={currentMedia.url}
                    alt={talent.name}
                    className="w-full h-full object-cover object-center transition-all duration-300"
                    referrerPolicy="no-referrer"
                  />
                )}

                {/* Slider Navigation Arrows */}
                {talent.media.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevMedia}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all backdrop-blur-sm z-20"
                      aria-label="Media Sebelumnya"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNextMedia}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all backdrop-blur-sm z-20"
                      aria-label="Media Selanjutnya"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Media Counter Pill */}
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/75 text-xs text-slate-200 font-mono border border-white/10 z-20">
                  {activeMediaIndex + 1} / {talent.media.length} · {currentMedia.type === 'video' ? 'Video' : 'Foto'}
                </div>
              </div>

              {/* Thumbnails Row */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                {talent.media.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`relative w-16 h-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      activeMediaIndex === idx
                        ? 'border-amber-400 shadow-lg shadow-amber-400/20 scale-105'
                        : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.type === 'video' && item.thumbnail ? item.thumbnail : item.url}
                      alt={item.title || `Media ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {item.type === 'video' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Physical Specs, Telegram Connect & Bio (5 cols on lg) */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              {/* Profile & Host Info Card */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-red-500/20 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                    Informasi Talent Host
                  </span>
                  <button
                    onClick={() => onToggleLike(talent.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isLiked
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:text-rose-400'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{talent.likesCount} Suka</span>
                  </button>
                </div>

                {/* Key Status Indicators */}
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[11px] text-slate-400 block mb-1">Status Keaktifan</span>
                    <span className={`font-semibold flex items-center gap-1.5 ${
                      talent.isLive ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {talent.isLive && <Radio className="w-3.5 h-3.5 animate-pulse" />}
                      <span>{talent.isLive ? 'Sedang Live Stream' : 'Standby / Booking'}</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[11px] text-slate-400 block mb-1">Karakter / Zodiak</span>
                    <span className="font-semibold text-white">{talent.zodiac || 'Eksklusif'}</span>
                  </div>
                </div>

                {/* Languages */}
                {talent.languages && talent.languages.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Bahasa Komunikasi:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {talent.languages.map((lang, idx) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-slate-200 border border-white/10 font-mono">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Telegram Connection & Booking Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-[#0A121E] to-[#0A0D14] border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#229ED9] flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                      <Send className="w-4 h-4 ml-0.5" />
                    </div>
                    <div>
                      <div className="text-xs text-cyan-300 font-semibold">Terkoneksi Telegram Resmi</div>
                      <div className="text-sm font-mono font-bold text-white">@{talent.telegramUsername}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyUsername}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                    title="Salin Username Telegram"
                  >
                    {copiedUsername ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Booking Topic Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">Pilih Topik Chat / Booking:</label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {bookingTopics.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setSelectedTopic(t.label)}
                        className={`p-2 rounded-lg text-left transition-colors border ${
                          selectedTopic === t.label
                            ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                            : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Action Button: Open Telegram directly */}
                <a
                  href={getCustomTelegramUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-black bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:brightness-110 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 group"
                >
                  <Send className="w-4 h-4 text-black group-hover:translate-x-0.5 transition-transform" />
                  <span>Buka Chat Telegram {talent.name}</span>
                </a>
              </div>

              {/* Bio & Services */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tentang Talent</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{talent.bio}</p>

                {knownServices(talent.services).length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Layanan</h4>
                    <div className="flex flex-wrap gap-2 text-xs text-amber-200">
                      {knownServices(talent.services).map((srv) => (
                        <span key={srv} className="px-2.5 py-1 rounded bg-white/5 border border-white/10">
                          {srv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jadwal live berikutnya */}
                {schedules.length > 0 && (
                  <div className="pt-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5" /> Jadwal Live
                    </h4>
                    <div className="space-y-1.5">
                      {schedules.slice(0, 5).map((s) => (
                        <div key={s.id} className="text-xs text-slate-200">
                          <span className="font-semibold text-red-300">{scheduleFormat.format(new Date(s.startsAt))}</span>
                          {s.note && <span className="text-slate-400"> · {s.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section: Customer Reviews & Rating (Bintang & Komentar) */}
          <div className="pt-8 border-t border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  <span>Ulasan & Rating Pengunjung</span>
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-300 mt-1">
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(talent.ratingAverage)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-white font-mono tabular-nums">
                    {talent.ratingAverage.toFixed(1)} / 5.0
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400">{talentReviews.length} Ulasan Terverifikasi</span>
                </div>
              </div>
            </div>

            {/* Write Review Form */}
            <form onSubmit={handleReviewSubmit} className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <h4 className="text-sm font-semibold text-slate-200">
                {currentUser ? `Tulis Ulasan sebagai ${currentUser.name}` : 'Masuk untuk Memberi Rating & Ulasan'}
              </h4>

              {/* Star selector */}
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="hidden sm:inline text-xs text-slate-400 mr-2">Pilih Rating:</span>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setNewRating(num)}
                      onMouseEnter={() => setHoverRating(num)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          num <= (hoverRating || newRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 ml-2 whitespace-nowrap">
                  {newRating} Bintang
                </span>
              </div>

              {/* Comment text area */}
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ceritakan pengalaman Anda (kesopanan, ketepatan waktu, kecocokan profil & foto)..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Satu ulasan per akun. Mengirim lagi akan mengganti ulasan lama Anda.
                </span>
                <button
                  type="submit"
                  disabled={isReviewSaving}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold text-black bg-gradient-to-r from-amber-300 to-amber-500 hover:brightness-110 transition-all shadow-md shadow-amber-500/20 disabled:opacity-60 disabled:cursor-wait"
                >
                  {isReviewSaving ? 'Mengirim...' : 'Kirim Ulasan & Rating'}
                </button>
              </div>

              {reviewError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {reviewError}
                </div>
              )}

              {reviewSubmitted && (
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">
                  Terima kasih! Ulasan dan rating Anda telah berhasil ditambahkan.
                </div>
              )}
            </form>

            {/* Reviews List */}
            <div className="space-y-3">
              {talentReviews.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  Belum ada ulasan untuk talent ini. Jadilah yang pertama memberikan ulasan!
                </div>
              ) : (
                talentReviews.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{rev.userName}</span>
                        {rev.isVerifiedClient && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Verified Client
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500">{rev.createdAt}</span>
                    </div>

                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                        />
                      ))}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>

                    <div className="flex items-center justify-end gap-3 text-[11px]">
                      <button
                        onClick={() =>
                          onReport({
                            targetType: 'review',
                            talentId: talent.id,
                            reviewId: rev.id,
                            label: `Ulasan dari ${rev.userName}`
                          })
                        }
                        className="text-slate-500 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Flag className="w-3 h-3" />
                        Laporkan
                      </button>
                      {(currentUser?.role === 'admin' || (currentUser && currentUser.id === rev.userId)) && (
                        <button
                          onClick={() => onDeleteReview(rev.id)}
                          className="text-slate-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
