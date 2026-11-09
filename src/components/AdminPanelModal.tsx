import React, { useEffect, useState } from 'react';
import { Talent, MediaItem, SiteSettings, Review } from '../types/talent';
import { TalentVerificationPanel } from './TalentVerificationPanel';
import { ReportsPanel } from './ReportsPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { AdminStatsPanel } from './AdminStatsPanel';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Radio,
  Save,
  RotateCcw,
  Settings,
  Users,
  Send,
  Sparkles,
  Image as ImageIcon,
  Check,
  Download,
  Upload,
  ShieldCheck,
  Flag,
  History,
  BarChart3
} from 'lucide-react';
import { uploadMedia, fetchReports, setTalentPassword as setTalentLoginPassword } from '../lib/db';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

interface AdminPanelModalProps {
  talents: Talent[];
  siteSettings: SiteSettings;
  onClose: () => void;
  onSaveTalent: (talent: Talent) => Promise<void>;
  onDeleteTalent: (id: string) => void;
  onResetDefaultTalents: () => void;
  onSaveSiteSettings: (settings: SiteSettings) => Promise<void>;
  onOpenBroadcastForTalent?: (talent: Talent) => void;
  reviews: Review[];
  onDeleteReview: (reviewId: string) => Promise<boolean>;
  onTalentChanged: (talentId: string) => Promise<void>;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  talents,
  siteSettings,
  onClose,
  onSaveTalent,
  onDeleteTalent,
  onResetDefaultTalents,
  onSaveSiteSettings,
  onOpenBroadcastForTalent,
  reviews,
  onDeleteReview,
  onTalentChanged
}) => {
  // Tabs: 'talents' or 'settings' or 'backup' or 'reports'
  const [activeTab, setActiveTab] = useState<'talents' | 'settings' | 'backup' | 'reports' | 'history' | 'stats'>('talents');
  const [verifyingTalentId, setVerifyingTalentId] = useState<string | null>(null);
  const [openReportCount, setOpenReportCount] = useState<number | null>(null);
  const verifyingTalent = talents.find((t) => t.id === verifyingTalentId) || null;

  // Hitung laporan yang belum ditangani untuk badge di tab "Laporan"
  useEffect(() => {
    fetchReports()
      .then((list) => setOpenReportCount(list.filter((r) => r.status === 'open').length))
      .catch(() => {});
  }, []);

  // Site Settings Form state
  const [settingsForm, setSettingsForm] = useState<SiteSettings>({ ...siteSettings });
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Talent Editing / Creating states
  const [editingTalent, setEditingTalent] = useState<Talent | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState<Partial<Talent>>({});
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [talentPassword, setTalentPassword] = useState(''); // password login talent (opsional)
  const [isSaving, setIsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  // Upload foto/video dari perangkat ke Supabase Storage, lalu masukkan ke slider media
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const added: MediaItem[] = [];
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const url = await uploadMedia(file, formData.id || 'umum');
        const firstImage = [...mediaList, ...added].find((m) => m.type === 'image')?.url;
        added.push({
          id: `media-${Date.now()}-${added.length}`,
          type: isVideo ? 'video' : 'image',
          url,
          thumbnail: isVideo ? firstImage : undefined,
          title: isVideo ? 'Video Reel' : 'Foto'
        });
      }
      setMediaList((prev) => [...prev, ...added]);
    } catch (err) {
      alert(`Upload gagal: ${errorText(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Settings Save Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    let sanitizedUsername = settingsForm.officialTelegramUsername.replace('@', '').trim();
    let sanitizedUrl = settingsForm.officialTelegramUrl.trim();

    if (!sanitizedUrl.startsWith('http')) {
      sanitizedUrl = `https://t.me/${sanitizedUsername}`;
    }

    const updated: SiteSettings = {
      ...settingsForm,
      officialTelegramUsername: sanitizedUsername,
      officialTelegramUrl: sanitizedUrl
    };

    setSettingsError('');
    setIsSaving(true);
    try {
      await onSaveSiteSettings(updated);
      setSettingsSavedMessage(true);
      setTimeout(() => setSettingsSavedMessage(false), 3000);
    } catch (err) {
      setSettingsError(`Gagal menyimpan pengaturan: ${errorText(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startCreate = () => {
    setTalentPassword('');
    setIsAddingNew(true);
    setEditingTalent(null);
    setFormData({
      id: `talent-${Date.now()}`,
      name: '',
      alias: '',
      city: 'Jakarta',
      age: 22,
      height: 165,
      weight: 48,
      braSize: '34B',
      isLive: false,
      liveStatusText: 'Standby',
      telegramUsername: '',
      bio: '',
      zodiac: 'Scorpio',
      languages: ['Indonesia', 'English'],
      services: ['VIP Dinner', 'Party Host'],
      rates: {
        dinnerDate: 'Rp 2.500.000 / 3 Jam',
        vipParty: 'Rp 4.500.000 / Malam'
      },
      likesCount: 15,
      ratingAverage: 5.0,
      reviewsCount: 1,
      verified: true
    });
    setMediaList([
      {
        id: `m-1`,
        type: 'image',
        url: '/images/talent_model_valerie_1794207018750.jpg',
        title: 'Foto Utama'
      }
    ]);
  };

  const startEdit = (talent: Talent) => {
    setTalentPassword('');
    setEditingTalent(talent);
    setIsAddingNew(false);
    setFormData({ ...talent });
    setMediaList([...talent.media]);
  };

  const handleAddMedia = () => {
    if (!newMediaUrl.trim()) return;
    const item: MediaItem = {
      id: `media-${Date.now()}`,
      type: newMediaType,
      url: newMediaUrl.trim(),
      thumbnail: newMediaType === 'video'
        ? mediaList.find((m) => m.type === 'image')?.url || '/images/talent_model_valerie_1794207018750.jpg'
        : undefined,
      title: `${newMediaType === 'video' ? 'Video Reel' : 'Foto'} Baru`
    };
    setMediaList([...mediaList, item]);
    setNewMediaUrl('');
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList(mediaList.filter((_, i) => i !== index));
  };

  const handleTalentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.telegramUsername) {
      alert('Nama dan Username Telegram wajib diisi!');
      return;
    }

    const completeTalent: Talent = {
      // Pertahankan data lain (featured, status tampil, info live, dll.) yang tidak ada di form
      ...(formData as Talent),
      isActive: formData.isActive ?? true,
      id: formData.id || `talent-${Date.now()}`,
      name: formData.name || '',
      alias: formData.alias || formData.name || '',
      city: (formData.city as any) || 'Jakarta',
      age: Number(formData.age) || 22,
      height: Number(formData.height) || 165,
      weight: Number(formData.weight) || 48,
      braSize: formData.braSize || '34B',
      isLive: Boolean(formData.isLive),
      liveStatusText: formData.isLive ? 'Sedang Live Stream' : 'Offline',
      telegramUsername: formData.telegramUsername.replace('@', '').trim(),
      telegramPhone: formData.telegramPhone || '',
      bio: formData.bio || 'Talent VIP profesional.',
      zodiac: formData.zodiac || 'Scorpio',
      languages: formData.languages || ['Indonesia', 'English'],
      services: formData.services || ['VIP Dinner', 'Party Mate'],
      rates: formData.rates || { dinnerDate: 'Rp 2.500.000 / 3 Jam' },
      media: mediaList.length > 0 ? mediaList : [
        {
          id: 'def-1',
          type: 'image',
          url: '/images/talent_model_valerie_1794207018750.jpg',
          title: 'Photo'
        }
      ],
      likesCount: formData.likesCount || 0,
      ratingAverage: formData.ratingAverage || 5.0,
      reviewsCount: formData.reviewsCount || 0,
      verified: true
    };

    if (talentPassword && talentPassword.length < 6) {
      alert('Password login talent minimal 6 karakter (atau kosongkan).');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveTalent(completeTalent);
    } catch (err) {
      alert(`Gagal menyimpan talent: ${errorText(err)}`);
      setIsSaving(false);
      return;
    }

    if (talentPassword) {
      try {
        await setTalentLoginPassword(completeTalent.id, talentPassword);
        alert(`Talent tersimpan. Login talent siap:\n\nNama: ${completeTalent.alias || completeTalent.name}\nPassword: ${talentPassword}\n\nBerikan ke talent-nya. Talent login di tab "Talent".`);
      } catch (err) {
        alert(`Talent tersimpan, tapi password login GAGAL dibuat: ${errorText(err)}`);
      }
    }

    setTalentPassword('');
    setEditingTalent(null);
    setIsAddingNew(false);
    setIsSaving(false);
  };

  // Export JSON backup
  const handleExportData = () => {
    const backupData = {
      talents,
      siteSettings,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paradox_vip_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-5xl bg-[#090A10] border border-red-500/30 rounded-2xl shadow-2xl p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[94dvh] sm:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-red-500/50 bg-black shrink-0">
              <img
                src={siteSettings.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-red-400 uppercase tracking-widest">
                Admin Master Studio
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span>Pengaturan Penuh Website & Telegram</span>
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => { setActiveTab('settings'); setIsAddingNew(false); setEditingTalent(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Pengaturan Website & CS Telegram</span>
          </button>

          <button
            onClick={() => setActiveTab('talents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'talents'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kelola Katalog Talent ({talents.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('reports'); setIsAddingNew(false); setEditingTalent(null); setVerifyingTalentId(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Laporan{openReportCount ? ` (${openReportCount})` : ''}</span>
          </button>

          <button
            onClick={() => { setActiveTab('stats'); setIsAddingNew(false); setEditingTalent(null); setVerifyingTalentId(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Statistik</span>
          </button>

          <button
            onClick={() => { setActiveTab('history'); setIsAddingNew(false); setEditingTalent(null); setVerifyingTalentId(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat</span>
          </button>

          <button
            onClick={() => { setActiveTab('backup'); setIsAddingNew(false); setEditingTalent(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup & Data</span>
          </button>
        </div>

        {/* Tab 1: Full Site Settings (Brand, Logo, Official Telegram) */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto space-y-6 pr-1">
            {settingsSavedMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Pengaturan berhasil disimpan dan langsung diterapkan ke seluruh website!</span>
              </div>
            )}
            {settingsError && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                {settingsError}
              </div>
            )}

            {/* Section 1: Telegram Official Configuration */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-black/50 to-black/30 border border-cyan-500/30 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-cyan-500/20">
                <Send className="w-4 h-4 text-cyan-400" />
                <h4 className="font-bold text-sm text-cyan-200">
                  Koneksi Telegram Official CS (Dapat Diganti Kapan Saja)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">
                    Username Bot Telegram CS (tanpa @)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.officialTelegramUsername}
                    onChange={(e) => {
                      const val = e.target.value.replace('@', '').trim();
                      setSettingsForm({
                        ...settingsForm,
                        officialTelegramUsername: val,
                        officialTelegramUrl: `https://t.me/${val}`
                      });
                    }}
                    placeholder="csparadox_bot"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-cyan-500/40 text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Semua tombol kontak CS official di header, hero, panduan, dan footer akan langsung tertuju ke bot ini.
                  </span>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">
                    URL Tautan Penuh Telegram
                  </label>
                  <input
                    type="url"
                    value={settingsForm.officialTelegramUrl}
                    onChange={(e) => setSettingsForm({ ...settingsForm, officialTelegramUrl: e.target.value })}
                    placeholder="https://t.me/csparadox_bot"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/10 text-white font-mono focus:outline-none focus:border-cyan-400"
                    required
                  />
                  <div className="mt-1">
                    <a
                      href={settingsForm.officialTelegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>Tes Buka Tautan Telegram ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Brand Identity & Logo */}
            <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Sparkles className="w-4 h-4 text-red-500" />
                <h4 className="font-bold text-sm text-white">Identitas Brand & Logo</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Nama Brand / Agensi</label>
                  <input
                    type="text"
                    value={settingsForm.brandName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, brandName: e.target.value })}
                    placeholder="PARADOX"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-display text-base font-bold focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Tagline Brand</label>
                  <input
                    type="text"
                    value={settingsForm.brandTagline}
                    onChange={(e) => setSettingsForm({ ...settingsForm, brandTagline: e.target.value })}
                    placeholder="VIP Talent & Nightlife Agency"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              </div>

              {/* Logo preview and URL input */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <label className="text-xs text-slate-300 block font-semibold">
                  URL Logo Gambar (Gambar Referensi PARADOX)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-red-500 bg-black shrink-0 shadow-lg shadow-red-600/30">
                    <img
                      src={settingsForm.logoUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={settingsForm.logoUrl}
                      onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
                      placeholder="/assets/aistudio/photo_2026-02-11_13-05-01_ed7e07ca.jpg"
                      className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/10 text-xs text-slate-200 font-mono focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsForm({
                            ...settingsForm,
                            logoUrl: '/assets/aistudio/photo_2026-02-11_13-05-01_ed7e07ca.jpg'
                          })
                        }
                        className="text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer"
                      >
                        Gunakan Logo Asli PARADOX (Bulan Merah)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Hero Headline & Text */}
            <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
              <h4 className="font-bold text-sm text-white pb-2 border-b border-white/10">
                Teks Banner Hero & Halaman Utama
              </h4>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Teks Bar Pengumuman Atas</label>
                  <input
                    type="text"
                    value={settingsForm.heroAnnouncement}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroAnnouncement: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Deskripsi / Subjudul Hero</label>
                  <textarea
                    value={settingsForm.heroSubtitle}
                    onChange={(e) => setSettingsForm({ ...settingsForm, heroSubtitle: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Teks Bantuan CS (Kotak Panduan)</label>
                  <input
                    type="text"
                    value={settingsForm.supportHeading}
                    onChange={(e) => setSettingsForm({ ...settingsForm, supportHeading: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            {/* Save Settings Button */}
            <div className="sticky bottom-0 bg-[#090A10]/95 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Perubahan akan langsung diterapkan ke seluruh halaman tanpa reload.
              </span>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Website'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Talent Catalog Management */}
        {activeTab === 'stats' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <AdminStatsPanel />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <AuditLogPanel />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <ReportsPanel
              talents={talents}
              reviews={reviews}
              onDeleteReview={onDeleteReview}
              onTalentChanged={onTalentChanged}
              onOpenCountChange={setOpenReportCount}
              onOpenVerification={(id) => {
                setVerifyingTalentId(id);
                setActiveTab('talents');
              }}
            />
          </div>
        )}

        {activeTab === 'talents' && (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {verifyingTalent ? (
              <TalentVerificationPanel
                talent={verifyingTalent}
                onBack={() => setVerifyingTalentId(null)}
                onChanged={onTalentChanged}
              />
            ) : isAddingNew || editingTalent ? (
              /* Add/Edit Form */
              <form onSubmit={handleTalentSubmit} className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-lg text-red-400">
                    {isAddingNew ? 'Tambah Talent Baru' : `Edit Talent: ${editingTalent?.name}`}
                  </h4>
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingTalent(null); }}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Batal
                  </button>
                </div>

                {/* Basic Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Nama Lengkap</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Contoh: Valerie Anastasya"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Nama Panggilan / Alias</label>
                    <input
                      type="text"
                      value={formData.alias || ''}
                      onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                      placeholder="Contoh: Valerie Queen"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Telegram Talent (Tanpa @)</label>
                    <input
                      type="text"
                      value={formData.telegramUsername || ''}
                      onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
                      required
                      placeholder="valerie_paradox_vip"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-cyan-500/40 text-cyan-200 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Zodiak / Karakter</label>
                    <input
                      type="text"
                      value={formData.zodiac || 'Scorpio'}
                      onChange={(e) => setFormData({ ...formData, zodiac: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Live Status Toggle */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Radio className={`w-5 h-5 ${formData.isLive ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-rose-300">Status Live Stream</div>
                    <div className="text-[11px] text-slate-400">
                      Tandai apakah talent sedang online live stream
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isLive: !formData.isLive })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formData.isLive ? 'bg-rose-600 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {formData.isLive ? 'LIVE AKTIF' : 'OFFLINE'}
                  </button>
                </div>

                {/* Password login talent */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <label className="text-xs text-slate-300 block font-semibold">
                    Password Login Talent {isAddingNew ? '(opsional)' : '(kosongkan jika tidak diganti)'}
                  </label>
                  <input
                    type="text"
                    value={talentPassword}
                    onChange={(e) => setTalentPassword(e.target.value)}
                    placeholder="min. 6 karakter"
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Talent login di tab "Talent" dengan memilih namanya dan memasukkan password ini.
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-semibold">Deskripsi / Bio Profil</label>
                  <textarea
                    value={formData.bio || ''}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    placeholder="Ceritakan pengalaman, kepribadian, dan preferensi acara..."
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                {/* Media Slider (Photos & Video) */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-red-400 uppercase tracking-wider block">
                    Media Slider (Foto & Video)
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={newMediaType}
                      onChange={(e) => setNewMediaType(e.target.value as any)}
                      className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white cursor-pointer"
                    >
                      <option value="image">Foto</option>
                      <option value="video">Video (MP4)</option>
                    </select>

                    <input
                      type="text"
                      value={newMediaUrl}
                      onChange={(e) => setNewMediaUrl(e.target.value)}
                      placeholder="URL Foto / Video (https://...)"
                      className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white"
                    />

                    <button
                      type="button"
                      onClick={handleAddMedia}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      Tambah dari URL
                    </button>
                  </div>

                  <label
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-xs font-semibold text-red-300 transition-colors ${
                      isUploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? 'Mengupload...' : 'Upload Foto / Video dari Perangkat (maks 50 MB per file)'}</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      disabled={isUploading}
                      onChange={handleUploadFiles}
                      className="hidden"
                    />
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {mediaList.map((m, idx) => (
                      <div key={m.id || idx} className="relative rounded-lg overflow-hidden border border-white/10 group aspect-[3/4] bg-slate-900">
                        <img
                          src={m.type === 'video' && m.thumbnail ? m.thumbnail : m.url}
                          alt="Media Preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                          {m.type === 'video' ? 'Video' : 'Foto'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(idx)}
                          className="absolute top-1 right-1 p-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingTalent(null); }}
                    className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isUploading}
                    className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:brightness-110 shadow-md shadow-red-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan Talent'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Talent List */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    Total <span className="font-semibold text-white">{talents.length}</span> talent aktif dalam katalog PARADOX.
                  </span>

                  <button
                    onClick={startCreate}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Talent Baru</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {talents.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl bg-black/40 border border-white/10 flex gap-4 items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-18 rounded-lg overflow-hidden shrink-0 bg-slate-900 border border-white/10">
                          <img
                            src={t.media[0]?.url || '/images/talent_model_valerie_1794207018750.jpg'}
                            alt={t.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <h5 className="font-bold text-sm text-white">{t.name}</h5>
                            {t.isLive && (
                              <span className="text-[10px] text-rose-400 bg-rose-500/20 px-1.5 py-0.2 rounded font-semibold animate-pulse">
                                LIVE
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {!t.idVerifiedAt && (
                              <span className="text-[10px] text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded font-semibold">
                                Belum diverifikasi
                              </span>
                            )}
                            {t.isActive === false && (
                              <span className="text-[10px] text-slate-300 bg-white/10 px-1.5 py-0.5 rounded font-semibold">
                                Disembunyikan
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {t.alias || 'VIP Talent'}
                          </div>
                          <div className="text-xs text-cyan-400 font-mono">
                            @{t.telegramUsername}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {onOpenBroadcastForTalent && (
                          <button
                            onClick={() => onOpenBroadcastForTalent(t)}
                            className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                            title="Buka Kamera Siaran Live untuk Talent ini"
                          >
                            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                          </button>
                        )}
                        <button
                          onClick={() => setVerifyingTalentId(t.id)}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            t.idVerifiedAt
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300'
                          }`}
                          title="Verifikasi identitas, dokumen & login talent"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(t)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-red-300 transition-colors cursor-pointer"
                          title="Edit Talent"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTalent(t.id)}
                          className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                          title="Hapus Talent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4">
              <h4 className="font-bold text-sm text-white">Ekspor & Reset Data</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Anda dapat mengunduh seluruh data talent dan konfigurasi website ke file JSON sebagai cadangan, atau mengembalikan pengaturan website ke bawaan awal PARADOX (data talent tidak ikut terhapus).
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup Data JSON</span>
                </button>

                <button
                  type="button"
                  onClick={onResetDefaultTalents}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Pengaturan Website ke Default</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
