import React, { useEffect, useState } from 'react';
import { Send, Copy, Check, Link2, Unlink, X } from 'lucide-react';
import {
  fetchTalentTelegramInfo,
  createTalentLinkCode,
  unlinkTalentTelegram,
  approveTalentLinkRequest,
  rejectTalentLinkRequest,
  TalentTelegramInfo
} from '../lib/db';

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
  const [copiedGeneral, setCopiedGeneral] = useState(false);
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

  const decide = async (id: string, approve: boolean, who: string) => {
    if (approve && !confirm(`Hubungkan ${who} sebagai ${talentName}? Pastikan akun ini benar milik ${talentName}.`)) return;
    setBusy(true);
    setError('');
    try {
      await (approve ? approveTalentLinkRequest(id) : rejectTalentLinkRequest(id));
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const generalUrl = info?.bot_username ? `https://t.me/${info.bot_username}` : '';
  const copyGeneral = async () => {
    try {
      await navigator.clipboard.writeText(generalUrl);
      setCopiedGeneral(true);
      setTimeout(() => setCopiedGeneral(false), 2000);
    } catch {
      /* salin manual */
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

          {info.requests?.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="text-[11px] text-amber-200 font-semibold">
                Permintaan absen menunggu persetujuan (username Telegram beda dengan profil):
              </div>
              {info.requests.map((r) => {
                const who = r.username ? `@${r.username}` : r.name || 'akun tanpa username';
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <span className="flex-1 min-w-0 truncate">
                      {who}
                      {r.username && r.name ? <span className="text-slate-400"> ({r.name})</span> : null}
                      <span className="text-slate-500"> · {dateFmt.format(new Date(r.created_at))}</span>
                    </span>
                    <button
                      onClick={() => decide(r.id, true, who)}
                      disabled={busy}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/40 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Setujui
                    </button>
                    <button
                      onClick={() => decide(r.id, false, who)}
                      disabled={busy}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Tolak
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!info.linked && generalUrl && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 space-y-2">
              <div className="text-[11px] text-slate-300">
                <b className="text-white">Link absen umum</b> (sama untuk semua talent): talent buka link ini, lalu pilih namanya
                di bot. Kalau username Telegram-nya sama dengan profil, langsung terhubung; kalau beda, admin perlu menyetujui.
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={generalUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white font-mono"
                />
                <button
                  onClick={copyGeneral}
                  className="px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 text-xs cursor-pointer shrink-0"
                >
                  {copiedGeneral ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedGeneral ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>
          )}

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
              {info.linked ? 'Buat link (ganti akun Telegram)' : 'Buat link khusus (sekali pakai)'}
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
