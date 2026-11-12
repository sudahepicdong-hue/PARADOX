import React, { useEffect, useRef, useState } from 'react';
import { X, Star, User, Calendar, Send, MapPin, ImagePlus, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { submitTalentApplication, ageFromBirthDate } from '../lib/db';
import { compressImage } from '../lib/compressImage';
import { Turnstile, TurnstileHandle, TURNSTILE_SITE_KEY } from './Turnstile';

interface TalentApplyModalProps {
  onClose: () => void;
}

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 5;

const inputClass =
  'w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500';

// Tanggal lahir paling muda yang boleh dipilih (tepat 18 tahun hari ini)
const maxBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const TalentApplyModal: React.FC<TalentApplyModalProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [telegram, setTelegram] = useState('');
  const [city, setCity] = useState('');
  const [about, setAbout] = useState('');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [isAdult, setIsAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Bersihkan preview foto saat modal ditutup
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    setIsPreparing(true);
    setError('');
    try {
      const added: { file: File; preview: string }[] = [];
      for (const f of files.slice(0, room)) {
        const small = await compressImage(f);
        if (!/^image\/(jpeg|png|webp)$/.test(small.type)) {
          setError('Ada foto yang formatnya tidak didukung. Pakai foto JPG, PNG, atau WebP.');
          continue;
        }
        if (small.size > 5 * 1024 * 1024) {
          setError('Ada foto yang terlalu besar (maks 5 MB).');
          continue;
        }
        added.push({ file: small, preview: URL.createObjectURL(small) });
      }
      setPhotos((prev) => [...prev, ...added]);
      if (files.length > room) setError(`Maksimal ${MAX_PHOTOS} foto.`);
    } finally {
      setIsPreparing(false);
    }
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Nama wajib diisi.');
    if (!birthDate) return setError('Tanggal lahir wajib diisi.');
    if (ageFromBirthDate(birthDate) < 18) return setError('Maaf, pendaftaran hanya untuk usia 18 tahun ke atas.');
    if (!/^@?[A-Za-z0-9_]{5,32}$/.test(telegram.trim().replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, ''))) {
      return setError('Username Telegram tidak valid. Contoh: @namakamu');
    }
    if (photos.length < MIN_PHOTOS) return setError(`Upload minimal ${MIN_PHOTOS} foto.`);
    if (!isAdult || !agree) return setError('Centang kedua pernyataan di bawah terlebih dahulu.');
    if (TURNSTILE_SITE_KEY && !captchaToken) return setError('Centang dulu kotak verifikasi "bukan robot".');

    setIsSending(true);
    try {
      await submitTalentApplication({
        name: name.trim(),
        birthDate,
        telegram: telegram.trim(),
        city: city.trim(),
        about: about.trim(),
        photos: photos.map((p) => p.file),
        captchaToken: captchaToken ?? ''
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSending(false);
      captchaRef.current?.reset();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#090A10] border border-red-500/40 rounded-2xl shadow-2xl p-5 sm:p-8 space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1 pr-6 pl-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 mb-2">
            <Star className="w-6 h-6" />
          </div>
          <h3 className="font-display text-2xl font-bold text-white">Daftar Jadi Talent</h3>
          <p className="text-xs text-slate-400">
            Isi data singkat di bawah. Admin PARADOX akan menghubungi kamu lewat Telegram.
          </p>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-white font-bold text-lg">Pendaftaran terkirim!</p>
              <p className="text-sm text-slate-400">
                Terima kasih, <b className="text-slate-200">{name.trim()}</b>. Admin akan menghubungi{' '}
                <b className="text-slate-200">@{telegram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, '')}</b>{' '}
                lewat Telegram. Pastikan username kamu benar dan pesan dari orang baru tidak diblokir.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-white/10 hover:bg-white/15 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nama panggilan *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nama kamu" className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tanggal lahir *</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={birthDate}
                    max={maxBirthDate()}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
                {birthDate && ageFromBirthDate(birthDate) >= 18 && (
                  <p className="text-[11px] text-slate-500 mt-1">Umur: {ageFromBirthDate(birthDate)} tahun</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kota</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Contoh: Jakarta" className={inputClass} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username Telegram *</label>
              <div className="relative">
                <Send className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  maxLength={60}
                  placeholder="@namakamu"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className={inputClass}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cek di Telegram: Pengaturan → Username.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Foto kamu * <span className="font-normal text-slate-500">({photos.length}/{MAX_PHOTOS}, minimal {MIN_PHOTOS})</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photos.map((p, i) => (
                  <div key={p.preview} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-black">
                    <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white hover:bg-red-600 cursor-pointer"
                      aria-label="Hapus foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isPreparing}
                    className="aspect-[3/4] rounded-lg border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-red-500 flex flex-col items-center justify-center gap-1 text-[11px] cursor-pointer disabled:cursor-wait"
                  >
                    {isPreparing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    <span>Tambah</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
              <p className="text-[11px] text-slate-500 mt-1">Foto wajah jelas & foto seluruh badan. Foto hanya dilihat admin.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tentang kamu</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Ceritakan singkat tentang dirimu (opsional)"
                className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} className="mt-0.5 accent-red-600 w-4 h-4 shrink-0" />
                <span>Saya berusia <b>18 tahun ke atas</b> dan bersedia menunjukkan KTP/identitas asli untuk verifikasi umur.</span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-red-600 w-4 h-4 shrink-0" />
                <span>Saya mendaftar atas kemauan sendiri, data yang saya isi benar, dan saya setuju dihubungi admin PARADOX lewat Telegram.</span>
              </label>
            </div>

            {TURNSTILE_SITE_KEY && <Turnstile ref={captchaRef} onToken={setCaptchaToken} />}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
            )}

            <button
              type="submit"
              disabled={isSending || isPreparing}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {isSending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSending ? 'Mengirim...' : 'Kirim Pendaftaran'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
