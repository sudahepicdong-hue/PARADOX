import React, { useState, useEffect, useRef } from 'react';
import { Talent } from '../types/talent';
import {
  X,
  Radio,
  Send,
  Users,
  Heart,
  MessageCircle,
  Volume2,
  VolumeX,
  Sparkles,
  Gift,
  Maximize2,
  Minimize2,
  Check
} from 'lucide-react';

interface LiveShowcaseModalProps {
  talent: Talent;
  onClose: () => void;
  onOpenDetail: (talent: Talent) => void;
  onToggleLike: (talentId: string) => void;
  isLiked: boolean;
  brandName?: string;
  activeMediaStream?: MediaStream | null;
}

interface LiveChat {
  id: string;
  user: string;
  text: string;
  gift?: string;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  left: number;
}

export const LiveShowcaseModal: React.FC<LiveShowcaseModalProps> = ({
  talent,
  onClose,
  onOpenDetail,
  onToggleLike,
  isLiked,
  brandName = 'PARADOX',
  activeMediaStream = null
}) => {
  const [isMuted, setIsMuted] = useState(true);
  const [viewers, setViewers] = useState(talent.liveViewersCount || 148);
  const [chatInput, setChatInput] = useState('');
  const [chats, setChats] = useState<LiveChat[]>([
    { id: '1', user: 'VipClubber_JKT', text: 'Malam kak! Senyumnya manis banget ❤️' },
    { id: '2', user: 'Rian_Bali', text: 'Keren banget outfitnya malam ini 🔥' },
    { id: '3', user: 'Hendro_P', text: 'Besok ready dinner date di SCBD kah?' },
    { id: '4', user: 'NightOwl99', text: 'Kirim bunga mawar buat kakak cantik 🌹', gift: '🌹' }
  ]);

  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [activeGiftSent, setActiveGiftSent] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Periodic simulated live viewer fluctuation
  useEffect(() => {
    const timer = setInterval(() => {
      setViewers((v) => Math.max(12, v + Math.floor(Math.random() * 5) - 2));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Periodic simulated incoming spectator comments
  useEffect(() => {
    const simulatedComments = [
      { user: 'Arthur_SCBD', text: 'Halo kak, fast response banget di Telegram!' },
      { user: 'Budi_Surabaya', text: 'Vibesnya elegan banget, cocok jadi host pesta kita.' },
      { user: 'Reza_VIP', text: 'Cantik natural, posturnya ideal banget 😍' },
      { user: 'Kevin_Jkt', text: 'Nanti malam ada jadwal hangout?', gift: '🍾' }
    ];

    const commentInterval = setInterval(() => {
      const randomComment = simulatedComments[Math.floor(Math.random() * simulatedComments.length)];
      setChats((prev) => [
        ...prev.slice(-15), // keep last 15 chats
        {
          id: Date.now().toString(),
          user: randomComment.user,
          text: randomComment.text,
          gift: randomComment.gift
        }
      ]);

      // Pop floating reaction
      if (randomComment.gift) {
        addReaction(randomComment.gift);
      }
    }, 7000);

    return () => clearInterval(commentInterval);
  }, []);

  // Hook live video stream object if provided
  useEffect(() => {
    if (activeMediaStream && videoRef.current) {
      videoRef.current.srcObject = activeMediaStream;
      videoRef.current.play().catch(console.error);
    }
  }, [activeMediaStream]);

  const addReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setReactions((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChats((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        user: 'Anda (VIP)',
        text: chatInput.trim()
      }
    ]);
    setChatInput('');
  };

  const handleSendGift = (giftName: string, emoji: string) => {
    addReaction(emoji);
    setActiveGiftSent(`Anda mengirim ${giftName} ${emoji}`);
    setChats((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        user: 'Anda (VIP)',
        text: `Mengirim hadiah virtual ${giftName} ${emoji}!`,
        gift: emoji
      }
    ]);
    setTimeout(() => setActiveGiftSent(null), 2500);
  };

  const telegramDirectUrl = `https://t.me/${talent.telegramUsername}?text=${encodeURIComponent(
    `Halo ${talent.name}, saya sedang menonton sesi LIVE Anda di ${brandName}! Mau konsultasi private chat / booking.`
  )}`;

  const videoSource =
    talent.liveStreamUrl ||
    talent.media.find((m) => m.type === 'video')?.url ||
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md">
      <div 
        ref={containerRef}
        className="relative w-full max-w-4xl bg-[#090A10] border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 text-slate-300 hover:text-white bg-black/70 rounded-full hover:bg-black/90 transition-colors cursor-pointer border border-white/10"
          aria-label="Tutup Live Stream"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Stream Stage */}
        <div className="relative flex-1 bg-black aspect-[4/5] md:aspect-auto flex items-center justify-center overflow-hidden">
          {activeMediaStream ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover transform -scale-x-100"
              autoPlay
              playsInline
              muted={isMuted}
            />
          ) : (
            <video
              src={videoSource}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted={isMuted}
              playsInline
            />
          )}

          {/* Floating animated reactions (hearts / gifts) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-10 text-3xl animate-bounce transition-all duration-1000 transform opacity-90"
                style={{
                  left: `${r.left}%`,
                  animation: 'floatUp 2s ease-out forwards'
                }}
              >
                {r.emoji}
              </div>
            ))}
          </div>

          {/* Top Live Bar */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black shadow-lg shadow-red-900/60">
              <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
              <span>LIVE</span>
            </span>
            <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-xs text-white border border-white/10">
              <Users className="w-3 h-3 text-red-400" />
              <span className="font-mono tabular-nums">{viewers} Menonton</span>
            </div>
          </div>

          {/* Video audio toggle & Like shortcut */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-full bg-black/70 text-white border border-white/20 hover:bg-black/90 cursor-pointer backdrop-blur-md"
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-300" /> : <Volume2 className="w-4 h-4 text-red-400" />}
            </button>
            <button
              onClick={() => {
                onToggleLike(talent.id);
                addReaction('❤️');
              }}
              className={`p-2.5 rounded-full border backdrop-blur-md transition-all cursor-pointer ${
                isLiked
                  ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/30'
                  : 'bg-black/70 text-white border-white/20 hover:bg-red-500/20'
              }`}
              title="Kirim Cinta ke Talent"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-white' : ''}`} />
            </button>
          </div>

          {/* Gift Sent Toast Banner */}
          {activeGiftSent && (
            <div className="absolute top-16 inset-x-4 z-30 flex justify-center">
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-red-600 to-rose-700 text-white text-xs font-bold shadow-xl shadow-red-600/40 flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{activeGiftSent}</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Interaction & Direct Telegram Call Side Panel */}
        <div className="w-full md:w-88 bg-[#0C0E14] border-t md:border-t-0 md:border-l border-white/10 flex flex-col justify-between p-4 sm:p-5">
          {/* Header Info */}
          <div className="space-y-3 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white flex items-center gap-1.5">
                  <span>{talent.name}</span>
                </h3>
                <span className="text-xs text-red-400 font-mono">
                  @{talent.telegramUsername}
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenDetail(talent);
                }}
                className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
              >
                Lihat Profil
              </button>
            </div>

            {/* Direct Telegram Live Call button */}
            <a
              href={telegramDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Private Chat / Booking di Telegram</span>
            </a>
          </div>

          {/* Virtual Gift Strip */}
          <div className="py-2 border-b border-white/5 space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
              <Gift className="w-3 h-3 text-red-400" />
              Kirim Hadiah Virtual Live
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSendGift('Mawar', '🌹')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-red-500/30 text-center transition-all cursor-pointer"
                title="Kirim Mawar Merah"
              >
                <div className="text-lg">🌹</div>
                <div className="text-[10px] text-slate-400">Mawar</div>
              </button>
              <button
                type="button"
                onClick={() => handleSendGift('Champagne', '🍾')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-red-500/30 text-center transition-all cursor-pointer"
                title="Kirim Champagne"
              >
                <div className="text-lg">🍾</div>
                <div className="text-[10px] text-slate-400">Champagne</div>
              </button>
              <button
                type="button"
                onClick={() => handleSendGift('Diamond VIP', '💎')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-red-500/30 text-center transition-all cursor-pointer"
                title="Kirim Diamond VIP"
              >
                <div className="text-lg">💎</div>
                <div className="text-[10px] text-slate-400">Diamond</div>
              </button>
              <button
                type="button"
                onClick={() => handleSendGift('Crown', '👑')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-red-500/30 text-center transition-all cursor-pointer"
                title="Kirim Mahkota Ratu"
              >
                <div className="text-lg">👑</div>
                <div className="text-[10px] text-slate-400">Crown</div>
              </button>
            </div>
          </div>

          {/* Live Chat stream */}
          <div className="flex-1 my-2 overflow-y-auto space-y-2 pr-1 max-h-44 md:max-h-56">
            <div className="text-[10px] text-red-400 font-mono tracking-wider uppercase mb-1">
              Live Chat Interaktif
            </div>
            {chats.map((c) => (
              <div key={c.id} className="text-xs bg-black/50 p-2 rounded-lg border border-white/5 flex items-start justify-between gap-1">
                <div>
                  <span className="font-semibold text-red-300 mr-1.5">{c.user}:</span>
                  <span className="text-slate-200">{c.text}</span>
                </div>
                {c.gift && <span className="text-sm shrink-0">{c.gift}</span>}
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="flex gap-2 pt-1 border-t border-white/5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Kirim pesan live..."
              className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
              title="Kirim Chat"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
