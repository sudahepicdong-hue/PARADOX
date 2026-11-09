import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { getPushState, enablePush, disablePush, PushState, PUSH_STATE_TEXT } from '../lib/push';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

// Saklar "Notifikasi live" (dipakai di Akun Saya dan di ajakan setelah like)
export const PushToggle: React.FC<{ compact?: boolean; onChange?: (s: PushState) => void }> = ({ compact, onChange }) => {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      const next = state === 'on' ? await disablePush() : await enablePush();
      setState(next);
      onChange?.(next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return null;
  const canToggle = state === 'on' || state === 'off';

  return (
    <div className="space-y-2">
      {!compact && <p className="text-[11px] text-slate-400 leading-relaxed">{PUSH_STATE_TEXT[state]}</p>}
      {canToggle ? (
        <button
          onClick={toggle}
          disabled={busy}
          className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
            state === 'on'
              ? 'text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10'
              : 'text-white bg-red-600 hover:bg-red-500'
          }`}
        >
          {state === 'on' ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {busy ? 'Memproses...' : state === 'on' ? 'Matikan notifikasi live' : 'Aktifkan notifikasi live'}
        </button>
      ) : (
        compact && <p className="text-[11px] text-amber-300 leading-relaxed">{PUSH_STATE_TEXT[state]}</p>
      )}
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
};
