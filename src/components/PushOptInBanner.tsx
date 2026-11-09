import React from 'react';
import { Bell, X } from 'lucide-react';
import { PushToggle } from './PushToggle';

const DISMISS_KEY = 'paradox_push_optin_dismissed';

export const wasPushOptInDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

// Muncul setelah member menyukai talent: tawarkan notifikasi saat talent itu live
export const PushOptInBanner: React.FC<{ talentName: string; onClose: () => void }> = ({ talentName, onClose }) => {
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* abaikan */
    }
    onClose();
  };

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-4 sm:left-auto sm:right-4 sm:w-96 z-[55] p-4 rounded-2xl bg-[#0C0E14]/95 border border-red-500/40 shadow-2xl backdrop-blur-md space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1 text-xs">
          <div className="font-bold text-white text-sm">Mau diberi tahu saat {talentName} live?</div>
          <p className="text-slate-400 mt-0.5">Notifikasi muncul di perangkat ini walau website sedang ditutup.</p>
        </div>
        <button onClick={dismiss} className="p-1 text-slate-500 hover:text-white cursor-pointer" aria-label="Tutup">
          <X className="w-4 h-4" />
        </button>
      </div>
      <PushToggle compact onChange={(s) => s === 'on' && setTimeout(onClose, 1200)} />
    </div>
  );
};
