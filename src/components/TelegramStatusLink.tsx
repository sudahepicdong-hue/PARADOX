import React, { useEffect, useState } from 'react';
import { Send, Copy, Check, Link2, Unlink } from 'lucide-react';
import { fetchTalentTelegramInfo, createTalentLinkCode, unlinkTalentTelegram, TalentTelegramInfo } from '../lib/db';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Menghubungkan akun Telegram talent ke bot status (/online, /offline).
// Dipakai di "Profil Saya" (talent) dan panel verifikasi (admin).
export const TelegramStatusLink: React.FC<{ talentId: string; talentName: string; isOnline?: boolean }> = ({
  talentId,
  talentName,
  isOnline
}) => {
  const [info, setInfo] = useState<TalentTelegramInfo | null>(null);
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchTalentTelegramInfo(talentId).then(setInfo).catch((e) => setError(errorText(e)));

  useEffect(() => {
    load();
  }, [talentId]);

  const makeLink = async () => {
    setBusy(true);
    setError('');
    try {
      setLink(await createTalentLinkCode(talentId));
      setCopied(false);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!confirm(`Putuskan Telegram ${talentName}? Status akan kembali Offline dan talent harus dihubungkan ulang.`)) return;
    setBusy(true);
    setError('');
    try {
      await unlinkTalentTelegram(talentId);
      setLink(null);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* browser menolak clipboard: link tetap bisa disalin manual */
    }
  };

  return (
    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
      <div>
        <h5 className="text-sm font-bold text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-cyan-400" /> Status Online lewat Telegram
        </h5>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Setelah terhubung, talent cukup kirim <b className="text-slate-200">/online</b> atau{' '}
          <b className="text-slate-200">/offline</b> ke bot. Status otomatis kembali Offline setelah 12 jam.
        </p>
      </div>

      {info === null ? (
        <p className="text-xs text-slate-400">{error || 'Memuat...'}</p>
      ) : !info.bot_ready ? (
        <p className="text-xs text-amber-300">Bot Telegram talent belum diatur di server. Hubungi admin.</p>
      ) : (
        <>
          <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Telegram:{' '}
              {info.linked ? (
                <span className="text-emerald-300 font-semibold">
                  Terhubung{info.username ? ` (@${info.username})` : ''}
                </span>
              ) : (
                <span className="text-amber-300 font-semibold">Belum terhubung</span>
              )}
            </span>
            {info.linked && (
              <span>
                Status:{' '}
                {isOnline ? (
                  <span className="text-emerald-300 font-semibold">🟢 Online</span>
                ) : (
                  <span className="text-slate-400 font-semibold">⚫ Offline</span>
                )}
              </span>
            )}
          </div>

          {link && (
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-2">
              <div className="text-[11px] text-cyan-200">
                Kirim link ini ke {talentName}. Sekali pakai, berlaku sampai {dateFmt.format(new Date(link.expires_at))}.
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white font-mono"
                />
                <button
                  onClick={copy}
                  className="px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 text-xs cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>
          )}

          {!link && info.pending_expires_at && !info.linked && (
            <p className="text-[11px] text-slate-400">
              Ada link yang belum dipakai (berlaku sampai {dateFmt.format(new Date(info.pending_expires_at))}). Buat link baru
              kalau link lama hilang — link lama otomatis batal.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={makeLink}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" />
              {info.linked ? 'Buat link (ganti akun Telegram)' : 'Buat link penghubung'}
            </button>
            {info.linked && (
              <button
                onClick={unlink}
                disabled={busy}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-rose-500/20 text-rose-300 border border-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" /> Putuskan
              </button>
            )}
          </div>
        </>
      )}

      {error && info !== null && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
};
