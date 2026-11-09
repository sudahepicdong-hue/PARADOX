import React, { useState } from 'react';
import { X, Save, Trash2, Upload, Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Talent, MediaItem } from '../types/talent';
import { uploadMedia } from '../lib/db';
import { MyDocumentsSection } from './MyDocumentsSection';
import { LiveScheduleManager } from './LiveScheduleManager';
import { LiveBansList } from './LiveBansList';

interface TalentProfileModalProps {
  talent: Talent;
  onClose: () => void;
  onSave: (talent: Talent) => Promise<void>;
  onDelete: (talentId: string) => Promise<void>;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Talent mengelola profilnya sendiri: data profil, foto/video, tampil/sembunyi, dan hapus profil.
export const TalentProfileModal: React.FC<TalentProfileModalProps> = ({ talent, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState({
    name: talent.name,
    alias: talent.alias,
    city: talent.city ?? '',
    telegramUsername: talent.telegramUsername,
    telegramPhone: talent.telegramPhone ?? '',
    zodiac: talent.zodiac,
    bio: talent.bio,
    languages: talent.languages.join(', '),
    services: talent.services.join(', '),
    liveStatusText: talent.liveStatusText ?? ''
  });
  const [media, setMedia] = useState<MediaItem[]>(talent.media);
  const [isActive, setIsActive] = useState(talent.isActive !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setIsUploading(true);
    setMessage(null);
    try {
      const added: MediaItem[] = [];
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const url = await uploadMedia(file, talent.id);
        added.push({
          id: `media-${Date.now()}-${added.length}`,
          type: isVideo ? 'video' : 'image',
          url,
          thumbnail: isVideo ? [...media, ...added].find((m) => m.type === 'image')?.url : undefined,
          title: isVideo ? 'Video Reel' : 'Foto'
        });
      }
      setMedia((prev) => [...prev, ...added]);
    } catch (err) {
      setMessage({ type: 'error', text: `Upload gagal: ${errorText(err)}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.telegramUsername.trim()) {
      setMessage({ type: 'error', text: 'Nama dan username Telegram wajib diisi.' });
      return;
    }
    if (media.length === 0) {
      setMessage({ type: 'error', text: 'Minimal harus ada 1 foto.' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await onSave({
        ...talent,
        name: form.name.trim(),
        alias: form.alias.trim() || form.name.trim(),
        city: form.city.trim() || undefined,
        telegramUsername: form.telegramUsername.replace('@', '').trim(),
        telegramPhone: form.telegramPhone.trim() || undefined,
        zodiac: form.zodiac.trim(),
        bio: form.bio.trim(),
        languages: splitList(form.languages),
        services: splitList(form.services),
        liveStatusText: form.liveStatusText.trim() || undefined,
        media,
        isActive
      });
      setMessage({ type: 'ok', text: 'Profil berhasil disimpan.' });
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal menyimpan: ${errorText(err)}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(talent.id);
      onClose();
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal menghapus profil: ${errorText(err)}` });
      setIsDeleting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500';
  const labelClass = 'text-xs text-slate-300 block mb-1 font-semibold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-3xl bg-[#090A10] border border-red-500/30 rounded-2xl shadow-2xl p-4 sm:p-8 space-y-6 max-h-[94dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <div className="text-[11px] font-semibold text-red-400 uppercase tracking-widest">Profil Saya</div>
            <h3 className="font-display text-xl font-bold text-white">{talent.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status verifikasi */}
        {talent.idVerifiedAt ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Identitas Anda sudah diverifikasi admin.</span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Profil Anda belum diverifikasi, jadi belum tampil di katalog. Upload dokumen identitas di bagian bawah halaman ini,
              lalu tunggu admin memverifikasi (wajib 18+).
            </span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Tampil / sembunyikan */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
            {isActive ? <Eye className="w-5 h-5 text-emerald-400" /> : <EyeOff className="w-5 h-5 text-slate-500" />}
            <div className="flex-1">
              <div className="text-xs font-semibold text-white">{isActive ? 'Profil ditampilkan' : 'Profil disembunyikan'}</div>
              <div className="text-[11px] text-slate-400">
                Sembunyikan kapan saja kalau Anda sedang tidak ingin terlihat di katalog.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                isActive ? 'bg-white/10 text-slate-200' : 'bg-emerald-600 text-white'
              }`}
            >
              {isActive ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nama</label>
              <input value={form.name} onChange={set('name')} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nama Panggilan / Alias</label>
              <input value={form.alias} onChange={set('alias')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Kota</label>
              <input value={form.city} onChange={set('city')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Zodiak</label>
              <input value={form.zodiac} onChange={set('zodiac')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Username Telegram (tanpa @)</label>
              <input value={form.telegramUsername} onChange={set('telegramUsername')} required className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>No. Telegram (opsional)</label>
              <input value={form.telegramPhone} onChange={set('telegramPhone')} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>Bahasa (pisahkan dengan koma)</label>
              <input value={form.languages} onChange={set('languages')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Layanan (pisahkan dengan koma)</label>
              <input value={form.services} onChange={set('services')} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Teks Status (contoh: "Online jam 20:00 WIB")</label>
            <input value={form.liveStatusText} onChange={set('liveStatusText')} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Bio</label>
            <textarea value={form.bio} onChange={set('bio')} rows={3} className={`${inputClass} resize-none`} />
          </div>

          {/* Foto & video */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-red-400 uppercase tracking-wider block">Foto & Video</label>
            <label
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-xs font-semibold text-red-300 ${
                isUploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? 'Mengupload...' : 'Upload Foto / Video (maks 50 MB per file)'}</span>
              <input type="file" accept="image/*,video/*" multiple disabled={isUploading} onChange={handleUpload} className="hidden" />
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {media.map((m, idx) => (
                <div key={m.id || idx} className="relative rounded-lg overflow-hidden border border-white/10 aspect-[3/4] bg-slate-900">
                  {m.type === 'video' && !m.thumbnail ? (
                    <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={m.type === 'video' ? m.thumbnail : m.url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                    {idx === 0 ? 'Utama' : m.type === 'video' ? 'Video' : 'Foto'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMedia(media.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 p-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {message && (
            <p
              className={`text-xs p-2.5 rounded-lg border ${
                message.type === 'ok'
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Profil'}</span>
            </button>
          </div>
        </form>

        <MyDocumentsSection talentId={talent.id} isVerified={Boolean(talent.idVerifiedAt)} />
        <LiveScheduleManager talentId={talent.id} />
        <LiveBansList talentId={talent.id} />

        {/* Hapus profil */}
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
          <div className="text-sm font-bold text-rose-300">Hapus Profil Permanen</div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Profil, foto/video yang Anda upload, ulasan, like, dan dokumen identitas Anda akan dihapus dan tidak bisa
            dikembalikan. Akun login Anda tetap ada sebagai member biasa. Ketik <b className="text-white">{talent.name}</b> untuk konfirmasi.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={talent.name}
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteConfirm.trim() !== talent.name || isDeleting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isDeleting ? 'Menghapus...' : 'Hapus Profil Saya'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
