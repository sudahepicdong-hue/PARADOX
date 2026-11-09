import React, { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  LocalTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
  createLocalTracks,
  VideoPresets,
  RemoteParticipant
} from 'livekit-client';
import { X, Mic, MicOff, Video, VideoOff, Radio, Users, Heart, AlertCircle, Loader2 } from 'lucide-react';
import { Talent } from '../types/talent';
import { getLiveToken, sendLiveHeartbeat } from '../lib/db';
import { ChatMessage, appendMessage, decodeData, encodeData, isHostParticipant, newMessageId } from '../lib/live';
import { LiveChat } from './LiveChat';

interface LiveBroadcastModalProps {
  talents: Talent[];
  initialTalent?: Talent;
  onClose: () => void;
  onStartLive: (talentId: string, title: string) => Promise<void>;
  onStopLive: (talentId: string) => Promise<void>;
  isTalentHost?: boolean;
}

type Phase = 'preview' | 'connecting' | 'live' | 'stopping';

const HEARTBEAT_MS = 30_000;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

// Studio siaran: kamera & mic talent dikirim sungguhan ke penonton lewat LiveKit.
export const LiveBroadcastModal: React.FC<LiveBroadcastModalProps> = ({
  talents,
  initialTalent,
  onClose,
  onStartLive,
  onStopLive,
  isTalentHost = false
}) => {
  const [selectedTalentId, setSelectedTalentId] = useState(initialTalent?.id || talents[0]?.id || '');
  const [title, setTitle] = useState('Sapa malam & ngobrol santai');
  const [phase, setPhase] = useState<Phase>('preview');
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  const roomRef = useRef<Room | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const liveTalentRef = useRef<string | null>(null); // talent yang sedang disiarkan

  const selectedTalent = talents.find((t) => t.id === selectedTalentId) || talents[0];
  const isLive = phase === 'live';

  // 1. Nyalakan preview kamera saat studio dibuka
  useEffect(() => {
    let cancelled = false;
    createLocalTracks({ audio: true, video: { facingMode: 'user', resolution: VideoPresets.h720.resolution } })
      .then((tracks) => {
        if (cancelled) {
          tracks.forEach((t) => t.stop());
          return;
        }
        tracksRef.current = tracks;
        const video = tracks.find((t) => t.kind === Track.Kind.Video);
        if (video && videoRef.current) video.attach(videoRef.current);
      })
      .catch((e) => {
        setCameraError(
          e?.name === 'NotAllowedError'
            ? 'Izin kamera/mikrofon ditolak. Izinkan akses kamera di pengaturan browser, lalu buka studio lagi.'
            : `Kamera tidak bisa dibuka: ${errorText(e)}`
        );
      });

    // 2. Saat studio ditutup: matikan kamera, putus koneksi, dan matikan status live
    return () => {
      cancelled = true;
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      roomRef.current?.disconnect();
      tracksRef.current.forEach((t) => t.stop());
      if (liveTalentRef.current) onStopLive(liveTalentRef.current).catch(() => {});
    };
  }, []);

  const updateViewers = (room: Room) => {
    let count = 0;
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      if (!isHostParticipant(p)) count++;
    });
    setViewers(count);
  };

  const startLive = async () => {
    if (!selectedTalent || tracksRef.current.length === 0) return;
    setError(null);
    setPhase('connecting');
    setMessages([]);
    setHearts(0);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    try {
      const { token, url } = await getLiveToken(selectedTalent.id, 'host');

      room
        .on(RoomEvent.ParticipantConnected, () => updateViewers(room))
        .on(RoomEvent.ParticipantDisconnected, () => updateViewers(room))
        .on(RoomEvent.DataReceived, (payload, participant) => {
          const data = decodeData(payload);
          if (!data) return;
          if (data.type === 'heart') setHearts((h) => h + 1);
          else
            setMessages((prev) =>
              appendMessage(prev, {
                id: newMessageId(),
                name: participant?.name || 'Tamu',
                text: data.text,
                isHost: isHostParticipant(participant)
              })
            );
        })
        .on(RoomEvent.Disconnected, () => {
          if (liveTalentRef.current) {
            setError('Koneksi siaran terputus. Periksa internet Anda lalu mulai live lagi.');
            stopLive();
          }
        });

      await room.connect(url, token);
      roomRef.current = room;
      for (const track of tracksRef.current) {
        await room.localParticipant.publishTrack(track);
      }

      await onStartLive(selectedTalent.id, title.trim() || 'Live');
      liveTalentRef.current = selectedTalent.id;
      updateViewers(room);

      // Detak setiap 30 detik: kalau berhenti (tab ditutup), status live otomatis mati
      heartbeatRef.current = window.setInterval(() => {
        sendLiveHeartbeat(selectedTalent.id).catch((e) => console.warn('Heartbeat gagal', e));
      }, HEARTBEAT_MS);

      setPhase('live');
    } catch (e) {
      room.disconnect();
      roomRef.current = null;
      setError(errorText(e));
      setPhase('preview');
    }
  };

  const stopLive = async () => {
    const talentId = liveTalentRef.current;
    liveTalentRef.current = null;
    setPhase('stopping');
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;

    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      for (const track of tracksRef.current) {
        await room.localParticipant.unpublishTrack(track, false).catch(() => {});
      }
      await room.disconnect();
    }
    if (talentId) await onStopLive(talentId).catch((e) => setError(errorText(e)));
    setViewers(0);
    setPhase('preview');
  };

  const handleClose = async () => {
    if (isLive && !confirm('Akhiri siaran live dan tutup studio?')) return;
    if (isLive) await stopLive();
    onClose();
  };

  const toggleCam = async () => {
    const video = tracksRef.current.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
    if (!video) return;
    if (camOn) await video.mute();
    else await video.unmute();
    setCamOn(!camOn);
  };

  const toggleMic = async () => {
    const audio = tracksRef.current.find((t) => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;
    if (!audio) return;
    if (micOn) await audio.mute();
    else await audio.unmute();
    setMicOn(!micOn);
  };

  const sendChat = (text: string) => {
    const room = roomRef.current;
    if (!room) return;
    room.localParticipant.publishData(encodeData({ type: 'chat', text }), { reliable: true }).catch(() => {});
    setMessages((prev) =>
      appendMessage(prev, { id: newMessageId(), name: selectedTalent?.name || 'Host', text, isHost: true, isMine: true })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#090A10] border border-red-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className={`w-5 h-5 shrink-0 ${isLive ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
            <h3 className="font-display font-bold text-white truncate">
              {isLive ? 'Sedang Live' : 'Studio Siaran Live'}
            </h3>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-0.5 rounded-full">
                <Users className="w-3.5 h-3.5" /> {viewers} penonton
                <Heart className="w-3.5 h-3.5 ml-1.5 text-rose-400" /> {hearts}
              </span>
            )}
          </div>
          <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3">
          {/* Kamera */}
          <div className="lg:col-span-2 p-3 sm:p-4 space-y-3">
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-slate-400 text-sm">
                  Kamera dimatikan
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/90">
                  <p className="text-sm text-rose-300 text-center flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" /> {cameraError}
                  </p>
                </div>
              )}
              {isLive && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
                </div>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                <button
                  onClick={toggleMic}
                  className={`p-2.5 rounded-full border cursor-pointer ${micOn ? 'bg-black/70 border-white/20 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}
                  title={micOn ? 'Matikan mikrofon' : 'Nyalakan mikrofon'}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleCam}
                  className={`p-2.5 rounded-full border cursor-pointer ${camOn ? 'bg-black/70 border-white/20 text-white' : 'bg-rose-600 border-rose-500 text-white'}`}
                  title={camOn ? 'Matikan kamera' : 'Nyalakan kamera'}
                >
                  {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Pengaturan siaran */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Talent</label>
                {isTalentHost ? (
                  <div className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white">{selectedTalent?.name}</div>
                ) : (
                  <select
                    value={selectedTalentId}
                    onChange={(e) => setSelectedTalentId(e.target.value)}
                    disabled={phase !== 'preview'}
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white cursor-pointer disabled:opacity-60"
                  >
                    {talents.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Judul Siaran</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  disabled={phase !== 'preview'}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500 disabled:opacity-60"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">{error}</p>
            )}

            {isLive || phase === 'stopping' ? (
              <button
                onClick={stopLive}
                disabled={phase === 'stopping'}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 cursor-pointer disabled:opacity-60"
              >
                {phase === 'stopping' ? 'Mengakhiri...' : 'Akhiri Live'}
              </button>
            ) : (
              <button
                onClick={startLive}
                disabled={phase === 'connecting' || Boolean(cameraError) || !selectedTalent}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'connecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                {phase === 'connecting' ? 'Menghubungkan...' : 'Mulai Live Sekarang'}
              </button>
            )}

            {selectedTalent && !selectedTalent.idVerifiedAt && (
              <p className="text-[11px] text-amber-300">
                Profil ini belum diverifikasi admin, jadi siarannya belum terlihat oleh pengunjung umum.
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Jangan tutup halaman ini selama live. Kalau browser tertutup, status live otomatis mati dalam ±1,5 menit.
            </p>
          </div>

          {/* Chat */}
          <div className="border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-[280px] lg:min-h-0">
            <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-slate-300">Chat Penonton</div>
            <LiveChat messages={messages} canChat disabled={!isLive} onSend={sendChat} />
          </div>
        </div>
      </div>
    </div>
  );
};
