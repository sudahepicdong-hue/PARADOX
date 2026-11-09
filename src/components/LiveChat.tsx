import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage, MAX_CHAT_LENGTH } from '../lib/live';

interface LiveChatProps {
  messages: ChatMessage[];
  canChat: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onRequestLogin?: () => void;
}

// Panel chat live. Nama pengirim berasal dari akun (diatur server), bukan diketik.
export const LiveChat: React.FC<LiveChatProps> = ({ messages, canChat, disabled, onSend, onRequestLogin }) => {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center pt-6">Belum ada chat. Sapa duluan!</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-xs leading-relaxed break-words">
              <span className={`font-semibold mr-1.5 ${m.isHost ? 'text-red-400' : m.isMine ? 'text-amber-300' : 'text-cyan-300'}`}>
                {m.name}
                {m.isHost && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-600 text-white align-middle">HOST</span>}
              </span>
              <span className="text-slate-200">{m.text}</span>
            </div>
          ))
        )}
      </div>

      {canChat ? (
        <form onSubmit={submit} className="p-2 border-t border-white/10 flex gap-2">
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
