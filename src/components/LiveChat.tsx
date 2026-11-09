import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, UserMinus, Ban } from 'lucide-react';
import { ChatMessage, MAX_CHAT_LENGTH, CHAT_COOLDOWN_MS } from '../lib/live';

export interface ChatModeration {
  onDelete: (m: ChatMessage) => void; // hapus pesan untuk semua orang
  onKick: (m: ChatMessage) => void; // keluarkan dari siaran sekarang
  onBan: (m: ChatMessage) => void; // blokir dari siaran talent ini seterusnya
}

interface LiveChatProps {
  messages: ChatMessage[];
  canChat: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onRequestLogin?: () => void;
  moderation?: ChatModeration; // hanya untuk host / admin
}

// Panel chat live. Nama pengirim berasal dari akun (diatur server), bukan diketik.
export const LiveChat: React.FC<LiveChatProps> = ({ messages, canChat, disabled, onSend, onRequestLogin, moderation }) => {
  const [text, setText] = useState('');
  const [coolingDown, setCoolingDown] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const wait = lastSentRef.current + CHAT_COOLDOWN_MS - Date.now();
    if (wait > 0) {
      setCoolingDown(true);
      setTimeout(() => setCoolingDown(false), wait);
      return;
    }
    lastSentRef.current = Date.now();
    onSend(t);
    setText('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center pt-6">Belum ada chat. Sapa duluan!</p>
        ) : (
          messages.map((m) => {
            const canModerate = moderation && !m.isHost && !m.isMine && m.senderIdentity;
            return (
              <div key={m.id} className="group text-xs leading-relaxed break-words">
                <span className={`font-semibold mr-1.5 ${m.isHost ? 'text-red-400' : m.isMine ? 'text-amber-300' : 'text-cyan-300'}`}>
                  {m.name}
                  {m.isHost && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-600 text-white align-middle">HOST</span>}
                </span>
                <span className="text-slate-200">{m.text}</span>
                {canModerate && (
                  <span className="ml-1.5 inline-flex gap-1 align-middle opacity-60 group-hover:opacity-100">
                    <button
                      onClick={() => moderation!.onDelete(m)}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                      title="Hapus pesan ini untuk semua orang"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moderation!.onKick(m)}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-amber-300 cursor-pointer"
                      title="Keluarkan dari siaran"
                    >
                      <UserMinus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moderation!.onBan(m)}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="Blokir dari siaran talent ini"
                    >
                      <Ban className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {canChat ? (
        <form onSubmit={submit} className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-white/10 space-y-1">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_CHAT_LENGTH}
              disabled={disabled}
              placeholder={disabled ? 'Chat aktif saat siaran berlangsung' : 'Tulis pesan...'}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disabled || !text.trim()}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white cursor-pointer disabled:opacity-40"
              aria-label="Kirim"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {coolingDown && <p className="text-[10px] text-slate-500 px-1">Tunggu sebentar sebelum mengirim lagi.</p>}
        </form>
      ) : (
        <button
          onClick={onRequestLogin}
          className="m-2 py-2 rounded-lg text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
        >
          Masuk untuk ikut chat
        </button>
      )}
    </div>
  );
};
