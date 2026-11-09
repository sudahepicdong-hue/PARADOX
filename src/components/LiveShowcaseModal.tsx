import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, DisconnectReason } from 'livekit-client';
import { X, Radio, Users, Heart, Volume2, Loader2, User as UserIcon } from 'lucide-react';
import { Talent } from '../types/talent';
import { getLiveToken, moderateLive } from '../lib/db';
import {
  ChatMessage,
  appendMessage,
  removeMessage,
  decodeData,
  encodeData,
  isHostParticipant,
  isModeratorParticipant,
  newMessageId
} from '../lib/live';
import { LiveChat, ChatModeration } from './LiveChat';

interface LiveShowcaseModalProps {
  talent: Talent;
  onClose: () => void;
  onOpenDetail: (talent: Talent) => void;
  onToggleLike: (talentId: string) => void;
  isLiked: boolean;
  brandName?: string;
  canChat: boolean; // sudah login?
  myName?: string;
  onRequestLogin: () => void;
  isModerator?: boolean; // admin yang menonton: boleh hapus pesan / keluarkan / blokir
}

type Status = 'connecting' | 'waiting' | 'playing' | 'ended' | 'error';

interface FloatingHeart {
  id: number;
  left: number;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

// Ruang tonton: video & suara asli dari kamera talent (LiveKit), chat & reaksi sungguhan.
export const LiveShowcaseModal: React.FC<LiveShowcaseModalProps> = ({
  talent,
  onClose,
  onOpenDetail,
  onToggleLike,
  isLiked,
  brandName = 'PARADOX',
  canChat,
  myName,
  onRequestLogin,
  isModerator = false
}) => {
  const [status, setStatus] = useState<Status>(talent.isLive ? 'connecting' : 'ended');
  const [error, setError] = useState('');
  const [viewers, setViewers] = useState(0);
  const [needsAudioClick, setNeedsAudioClick] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioBoxRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  const popHeart = () => {
    const id = Date.now() + Math.random();
    setHearts((h) => [...h.slice(-20), { id, left: 15 + Math.random() * 70 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1600);
  };

  // Sambung ke ruang live sekali saat modal dibuka (dan talent sedang live)
  useEffect(() => {
    if (!talent.isLive) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const countViewers = () => {
      let n = 1; // diri sendiri
      room.remoteParticipants.forEach((p: RemoteParticipant) => {
        if (!isHostParticipant(p)) n++;
      });
      setViewers(n);
    };

    const hostHasVideo = () => {
      let found = false;
      room.remoteParticipants.forEach((p) => {
        if (isHostParticipant(p) && p.getTrackPublication(Track.Source.Camera)?.track) found = true;
      });
      return found;
    };

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
        if (!isHostParticipant(participant)) return;
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          setStatus('playing');
        } else if (track.kind === Track.Kind.Audio && audioBoxRef.current) {
          audioBoxRef.current.appendChild(track.attach());
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
        if (!hostHasVideo()) setStatus('waiting');
      })
      .on(RoomEvent.ParticipantConnected, countViewers)
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        countViewers();
        if (isHostParticipant(p)) setStatus('ended');
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioClick(!room.canPlaybackAudio))
      .on(RoomEvent.DataReceived, (payload, participant) => {
        const data = decodeData(payload);
        if (!data) return;
        if (data.type === 'heart') popHeart();
        else if (data.type === 'delete') {
          // Hanya host / moderator yang boleh menghapus pesan orang lain
          if (isModeratorParticipant(participant)) setMessages((prev) => removeMessage(prev, data.id));
        } else
          setMessages((prev) =>
            appendMessage(prev, {
              id: data.id,
              name: participant?.name || 'Tamu',
              text: data.text,
              isHost: isHostParticipant(participant),
              senderIdentity: participant?.identity
            })
          );
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (cancelled) return;
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
          setError('Anda dikeluarkan dari siaran ini oleh host.');
          setStatus('error');
        }
      });

    (async () => {
      try {
        const { token, url } = await getLiveToken(talent.id, 'viewer');
        if (cancelled) return;
        await room.connect(url, token);
        if (cancelled) return;
        countViewers();
        setNeedsAudioClick(!room.canPlaybackAudio);
        if (!hostHasVideo()) setStatus((s) => (s === 'playing' ? s : 'waiting'));
      } catch (e) {
        if (!cancelled) {
          const msg = errorText(e);
          setError(msg.includes('diblokir') ? msg : `Gagal memuat siaran: ${msg}`);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [talent.id]);

  // Talent mengakhiri live (diketahui lewat update real-time)
  useEffect(() => {
    if (!talent.isLive) setStatus('ended');
  }, [talent.isLive]);

  const sendChat = (text: string) => {
    const room = roomRef.current;
    if (!room) return;
    const id = newMessageId();
    room.localParticipant.publishData(encodeData({ type: 'chat', id, text }), { reliable: true }).catch(() => {});
    setMessages((prev) => appendMessage(prev, { id, name: myName || 'Saya', text, isHost: false, isMine: true }));
  };

  // Moderasi oleh admin yang sedang menonton
  const deleteForAll = (ids: string[]) => {
    for (const id of ids) {
      roomRef.current?.localParticipant.publishData(encodeData({ type: 'delete', id }), { reliable: true }).catch(() => {});
    }
    setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
  };

  const moderation: ChatModeration = {
    onDelete: (m) => deleteForAll([m.id]),
    onKick: async (m) => {
      if (!m.senderIdentity || !confirm(`Keluarkan ${m.name} dari siaran?`)) return;
      try {
        await moderateLive(talent.id, 'kick', m.senderIdentity, m.name);
      } catch (e) {
        alert(errorText(e));
      }
    },
    onBan: async (m) => {
      if (!m.senderIdentity || !confirm(`Blokir ${m.name} dari siaran ${talent.name}?`)) return;
      try {
        await moderateLive(talent.id, 'ban', m.senderIdentity, m.name);
        deleteForAll(messages.filter((x) => x.senderIdentity === m.senderIdentity).map((x) => x.id));
      } catch (e) {
        alert(errorText(e));
      }
    }
  };

  const sendHeart = () => {
    if (!canChat) {
      onRequestLogin();
      return;
    }
    roomRef.current?.localParticipant.publishData(encodeData({ type: 'heart' }), { reliable: false }).catch(() => {});
    popHeart();
  };

  const cover = talent.media.find((m) => m.type === 'image')?.url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#090A10] sm:border border-red-500/40 sm:rounded-2xl shadow-2xl overflow-hidden sm:my-auto flex flex-col h-[100dvh] sm:h-auto sm:max-h-[96vh]">
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3 border-b border-white/10 flex items-center justify-between gap-3">
          <button onClick={() => onOpenDetail(talent)} className="flex items-center gap-3 min-w-0 text-left cursor-pointer group">
            <img src={cover} alt={talent.name} className="w-9 h-9 rounded-full object-cover border border-red-500/50 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate group-hover:text-red-300">{talent.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{talent.liveStreamTitle || `Live di ${brandName}`}</div>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {status === 'playing' && (
              <span className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded-full">
                <Users className="w-3.5 h-3.5" /> {viewers}
              </span>
            )}
            <button
              onClick={() => onToggleLike(talent.id)}
              className={`p-2 rounded-lg border cursor-pointer ${isLiked ? 'bg-rose-600/20 border-rose-500/50 text-rose-400' : 'border-white/10 text-slate-400 hover:text-rose-300'}`}
              title={isLiked ? 'Batal suka' : 'Suka'}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Tutup">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 overflow-y-auto overscroll-contain lg:overflow-visible">
          {/* Video */}
          <div className="lg:col-span-2 p-3 sm:p-4">
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
              <div ref={audioBoxRef} className="hidden" />

              {status !== 'playing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/80">
                  {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />}
                  <div className="relative space-y-2">
                    {status === 'connecting' && (
                      <p className="text-sm text-slate-300 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Menghubungkan ke siaran...</p>
                    )}
                    {status === 'waiting' && <p className="text-sm text-slate-300">Menunggu video dari {talent.name}...</p>}
                    {status === 'ended' && (
                      <>
                        <p className="text-sm text-slate-200 font-semibold">{talent.name} sedang tidak live.</p>
                        <button
                          onClick={() => onOpenDetail(talent)}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                        >
                          Lihat Profil
                        </button>
                      </>
                    )}
                    {status === 'error' && <p className="text-sm text-rose-300">{error}</p>}
                  </div>
                </div>
              )}

              {status === 'playing' && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE
                </div>
              )}

              {status === 'playing' && needsAudioClick && (
                <button
                  onClick={() => roomRef.current?.startAudio()}
                  className="absolute bottom-3 left-3 px-3 py-2 rounded-lg bg-black/80 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" /> Ketuk untuk nyalakan suara
                </button>
              )}

              {/* Hati melayang */}
              {hearts.map((h) => (
                <Heart
                  key={h.id}
                  className="absolute bottom-4 w-6 h-6 text-rose-500 fill-rose-500 pointer-events-none animate-ping"
                  style={{ left: `${h.left}%` }}
                />
              ))}

              {status === 'playing' && (
                <button
                  onClick={sendHeart}
                  className="absolute bottom-3 right-3 p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg cursor-pointer"
                  title="Kirim hati"
                >
                  <Heart className="w-5 h-5 fill-white" />
                </button>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-[280px] lg:min-h-0">
            <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" /> Live Chat
            </div>
            <LiveChat
              messages={messages}
              canChat={canChat}
              disabled={status !== 'playing'}
              onSend={sendChat}
              onRequestLogin={onRequestLogin}
              moderation={isModerator && status === 'playing' ? moderation : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
