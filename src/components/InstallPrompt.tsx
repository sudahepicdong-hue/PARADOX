import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

// Event bawaan Chrome/Android yang belum ada di tipe TypeScript standar
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'paradox_install_dismissed';

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

const isIosSafari = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

// Banner kecil "Install aplikasi" di HP.
//  - Android/Chrome: tombol install langsung
//  - iPhone/Safari : petunjuk "Bagikan > Tambah ke Layar Utama"
export const InstallPrompt: React.FC<{ brandName: string }> = ({ brandName }) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(() => wasDismissed() || isStandalone());

  useEffect(() => {
    if (hidden) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iPhone tidak punya event install: tampilkan petunjuk setelah beberapa detik
    const timer = isIosSafari() ? window.setTimeout(() => setShowIos(true), 8000) : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, [hidden]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* abaikan */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setHidden(true);
  };

  if (hidden || (!deferred && !showIos)) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:w-96 z-40 p-4 rounded-2xl bg-[#0C0E14]/95 border border-red-500/40 shadow-2xl backdrop-blur-md flex items-start gap-3">
      <img src="/icons/apple-touch-icon.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 text-xs">
        <div className="font-bold text-white text-sm">Install aplikasi {brandName}</div>
        {deferred ? (
          <>
            <p className="text-slate-400 mt-0.5">Buka lebih cepat langsung dari layar utama HP.</p>
            <button
              onClick={install}
              className="mt-2 px-3 py-1.5 rounded-lg font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Install
            </button>
          </>
        ) : (
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            Ketuk <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <b className="text-slate-200">Bagikan</b> di bawah layar, lalu pilih{' '}
            <b className="text-slate-200">Tambah ke Layar Utama</b>.
          </p>
        )}
      </div>
      <button onClick={dismiss} className="p-1 text-slate-500 hover:text-white cursor-pointer" aria-label="Tutup">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
