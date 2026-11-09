import React, { useState, useRef, useEffect } from 'react';
import { Talent } from '../types/talent';
import {
  X,
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Send,
  Users,
  Sparkles,
  Heart,
  MessageCircle,
  AlertCircle
} from 'lucide-react';

interface LiveBroadcastModalProps {
  talents: Talent[];
  initialTalent?: Talent;
  onClose: () => void;
  onStartLive: (talentId: string, title: string, streamType: 'camera' | 'video', customUrl?: string) => void;
  onStopLive: (talentId: string) => void;
  isTalentHost?: boolean;
}

export const LiveBroadcastModal: React.FC<LiveBroadcastModalProps> = ({
  talents,
  initialTalent,
  onClose,
  onStartLive,
  onStopLive,
  isTalentHost = false
}) => {
  const [selectedTalentId, setSelectedTalentId] = useState<string>(
    initialTalent?.id || talents[0]?.id || ''
  );
  const [streamTitle, setStreamTitle] = useState(
    'Sapa Malam Eksklusif & Ngobrol Santai Bareng VIP'
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [streamMode, setStreamMode] = useState<'camera' | 'video'>('camera');
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  // Simulated live room stats during broadcast
  const [liveViewers, setLiveViewers] = useState(65);
  const [liveChats, setLiveChats] = useState([
    { id: '1', user: 'VipClubber', text: 'Halo cantik, salam dari Jakarta!' },
    { id: '2', user: 'Dimas_Bali', text: 'Keren banget siaran langsungnya 🔥' }
  ]);
  const [hostReply, setHostReply] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedTalent = talents.find((t) => t.id === selectedTalentId) || talents[0];

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
      } else {
        setCameraError('Akses kamera tidak didukung di peramban ini. Siaran dialihkan ke Mode Video Studio.');
        setStreamMode('video');
      }
    } catch (_err) {
      // Permission denied or camera not found - handle gracefully without console.error
      setCameraActive(false);
      setCameraError(
        'Akses kamera belum diizinkan oleh peramban atau iframe. Siaran otomatis dialihkan ke Mode Video Studio & Teaser Reel talent.'
      );
      setStreamMode('video');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Toggle Mic
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !micActive));
      setMicActive(!micActive);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle start broadcast
  const handleStartBroadcast = () => {
    setIsBroadcasting(true);
    onStartLive(
      selectedTalentId,
      streamTitle,
      streamMode,
      customVideoUrl || undefined
    );
  };

  // Handle stop broadcast
  const handleStopBroadcast = () => {
    setIsBroadcasting(false);
    onStopLive(selectedTalentId);
    stopCamera();
  };

  const handleSendHostReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostReply.trim()) return;
    setLiveChats((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        user: `${selectedTalent.name} (Host)`,
        text: hostReply.trim()
      }
    ]);
    setHostReply('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-[#090A10] border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500">
              <Radio className={`w-5 h-5 ${isBroadcasting ? 'animate-pulse text-red-500' : ''}`} />
            </div>
            <div>
              <div className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                PARADOX Live Broadcast Studio
              </div>
              <h3 className="font-display font-bold text-lg text-white">
                {isBroadcasting ? '🔴 Siaran Langsung Sedang Berjalan' : 'Mulai Siaran Kamera Talent (Go Live)'}
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              if (isBroadcasting) {
                if (confirm('Hentikan siaran langsung sebelum keluar?')) {
                  handleStopBroadcast();
                  onClose();
                }
              } else {
                stopCamera();
                onClose();
              }
            }}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Camera / Video Stage (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full rounded-2xl overflow-hidden bg-black border-2 border-red-950/60 flex items-center justify-center shadow-xl">
                {/* Live Camera Stream */}
                {streamMode === 'camera' ? (
                  <>
                    <video
                      ref={videoRef}
                      className={`w-full h-full object-cover transform -scale-x-100 ${
                        cameraActive ? 'block' : 'hidden'
                      }`}
                      playsInline
                      muted
                    />

                    {!cameraActive && (
                      <div className="p-6 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-slate-400">
                          <Camera className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="text-sm text-slate-300 font-medium">
                          Kamera Belum Aktif
                        </div>
                        <p className="text-xs text-slate-500 max-w-xs">
                          Klik tombol di bawah untuk menyalakan webcam laptop atau kamera HP talent.
                        </p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg shadow-red-600/30 cursor-pointer inline-flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Nyalakan Kamera Talent</span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Demo Video Stream Mode */
                  <video
                    src={
                      customVideoUrl ||
                      selectedTalent.media.find((m) => m.type === 'video')?.url ||
                      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
                    }
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                )}

                {/* Overlays on Stage */}
                {isBroadcasting && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
                    <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg shadow-red-900/60">
                      <Radio className="w-3 h-3 animate-pulse" />
                      <span>LIVE</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-mono border border-white/10 flex items-center gap-1">
                      <Users className="w-3 h-3 text-red-400" />
                      <span>{liveViewers} Menonton</span>
                    </span>
                  </div>
                )}

                {/* Talent Watermark */}
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white z-20">
                  <div className="font-bold flex items-center gap-1">
                    <span>{selectedTalent.name}</span>
                    <span className="text-[10px] text-red-400">(@{selectedTalent.telegramUsername})</span>
                  </div>
                </div>

                {/* Device controls on camera */}
                {cameraActive && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={`p-2 rounded-full border backdrop-blur-md transition-colors cursor-pointer ${
                        micActive
                          ? 'bg-black/70 text-white border-white/20'
                          : 'bg-rose-600 text-white border-rose-500'
                      }`}
                      title={micActive ? 'Matikan Mic' : 'Nyalakan Mic'}
                    >
                      {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="p-2 rounded-full bg-black/70 text-rose-400 border border-white/20 hover:bg-black cursor-pointer"
                      title="Matikan Kamera"
                    >
                      <VideoOff className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Source Mode Selector: Camera vs Reel Video */}
              <div className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/5 text-xs">
                <span className="text-slate-400 font-medium">Sumber Siaran:</span>
                <button
                  type="button"
                  onClick={() => {
                    setStreamMode('camera');
                    if (!cameraActive) startCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    streamMode === 'camera'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Kamera Perangkat (Webcam / HP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStreamMode('video');
                    stopCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    streamMode === 'video'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Video Teaser / OBS Reel
                </button>
              </div>

              {/* Video Reel Selector when in video mode */}
              {streamMode === 'video' && (
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2 text-xs">
                  <span className="text-slate-300 font-semibold block">Pilih Video Teaser Talent:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4')}
                      className={`px-3 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        customVideoUrl === 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' || (!customVideoUrl && selectedTalent.media.some(m => m.url.includes('ForBiggerBlazes')))
                          ? 'bg-red-600/30 border-red-500 text-white font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      VIP Lounge Greeting
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4')}
                      className={`px-3 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        customVideoUrl === 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
                          ? 'bg-red-600/30 border-red-500 text-white font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Sunset Trip Teaser
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4')}
                      className={`px-3 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        customVideoUrl === 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
                          ? 'bg-red-600/30 border-red-500 text-white font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Behind The Scenes Reel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Broadcast Settings & Live Chat Panel (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Select Talent or Locked Talent Host Profile */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {isTalentHost ? 'Profil Host Talent Anda (Terkunci):' : 'Pilih Talent yang Sedang Siaran:'}
                </label>
                {isTalentHost ? (
                  <div className="p-3 rounded-xl bg-red-600/10 border border-red-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-red-500 shrink-0">
                        <img
                          src={selectedTalent.media[0]?.url || ''}
                          alt={selectedTalent.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{selectedTalent.name}</span>
                          <span className="text-[10px] bg-red-600/40 text-red-300 px-1.5 py-0.2 rounded font-mono">
                            Host
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          @{selectedTalent.telegramUsername}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                      Tervalidasi
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedTalentId}
                    onChange={(e) => setSelectedTalentId(e.target.value)}
                    disabled={isBroadcasting}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {talents.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (@{t.telegramUsername})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Title input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Judul Sesi Live:
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  disabled={isBroadcasting}
                  placeholder="Contoh: Sapa Malam VIP & Q&A Bareng Valerie"
                  className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Start / Stop Broadcast Action */}
              <div className="pt-2">
                {!isBroadcasting ? (
                  <button
                    type="button"
                    onClick={handleStartBroadcast}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Radio className="w-4 h-4 animate-pulse text-white" />
                    <span>Mulai Siaran Live Sekarang</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopBroadcast}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-black/80 hover:bg-black border border-rose-500/50 text-rose-300 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Radio className="w-4 h-4 text-rose-500" />
                    <span>Hentikan Siaran Live</span>
                  </button>
                )}
              </div>

              {/* Live Chat & Feedback Area */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300 border-b border-white/10 pb-2">
                  <span className="font-semibold text-red-400 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Obrolan Penonton Live
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {liveChats.length} pesan
                  </span>
                </div>

                <div className="h-32 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {liveChats.map((c) => (
                    <div key={c.id} className="p-1.5 rounded bg-white/[0.03] border border-white/5">
                      <span className="font-semibold text-red-300 mr-1">{c.user}:</span>
                      <span className="text-slate-200">{c.text}</span>
                    </div>
                  ))}
                </div>

                {/* Talent Host Chat Input */}
                <form onSubmit={handleSendHostReply} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={hostReply}
                    onChange={(e) => setHostReply(e.target.value)}
                    placeholder="Balas chat sebagai talent host..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
