import React, { useState, useEffect } from 'react';
import { Talent, Review, UserAccount, SiteSettings } from './types/talent';
import { DEFAULT_SITE_SETTINGS } from './data/initialTalents';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CatalogSection } from './components/CatalogSection';
import { TalentDetailModal } from './components/TalentDetailModal';
// Library live streaming cukup besar, jadi baru dimuat saat ruang live dibuka
const LiveShowcaseModal = React.lazy(() =>
  import('./components/LiveShowcaseModal').then((m) => ({ default: m.LiveShowcaseModal }))
);
const LiveBroadcastModal = React.lazy(() =>
  import('./components/LiveBroadcastModal').then((m) => ({ default: m.LiveBroadcastModal }))
);
import { AuthModal } from './components/AuthModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { BookingGuide } from './components/BookingGuide';
import { Footer } from './components/Footer';
import { ReportModal, ReportTarget } from './components/ReportModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { TalentProfileModal } from './components/TalentProfileModal';
import { AccountModal } from './components/AccountModal';
import { AgeGate, hasConfirmedAge } from './components/AgeGate';
import { UpcomingLives } from './components/UpcomingLives';
import { InstallPrompt } from './components/InstallPrompt';
import { Radio, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';
import { loadAccount, signOut } from './lib/auth';
import * as db from './lib/db';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

export default function App() {
  // Semua data di bawah ini dimuat dari Supabase saat halaman dibuka.
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [schedules, setSchedules] = useState<db.LiveSchedule[]>([]);
  const reloadSchedules = () =>
    db.fetchUpcomingSchedules().then(setSchedules).catch((e) => console.warn('Gagal memuat jadwal live', e));
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // User yang sedang login (diambil dari sesi Supabase Auth)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  // Talent yang di-like oleh user yang sedang login
  const [likedTalentIds, setLikedTalentIds] = useState<string[]>([]);

  // Modals state
  const [selectedDetailTalent, setSelectedDetailTalent] = useState<Talent | null>(null);
  const [selectedLiveTalent, setSelectedLiveTalent] = useState<Talent | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState<boolean>(false);
  const [broadcastInitialTalent, setBroadcastInitialTalent] = useState<Talent | undefined>(undefined);
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>('all');
  const [liveToastMessage, setLiveToastMessage] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Katalog publik hanya menampilkan talent yang aktif & sudah diverifikasi 18+
  // Status live dihitung ulang setiap 30 detik: kalau "detak" dari talent berhenti, badge LIVE hilang sendiri
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const talentsView = React.useMemo(
    () => talents.map((t) => (t.isLive && !db.isLiveNow(t, nowTick) ? { ...t, isLive: false } : t)),
    [talents, nowTick]
  );
  const publicTalents = talentsView.filter(db.isPubliclyVisible);

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(hasConfirmedAge);
  const myTalent = currentUser?.role === 'talent' ? talents.find((t) => t.id === currentUser.talentId) : undefined;

  const showToast = (message: string, ms = 4000) => {
    setLiveToastMessage(message);
    setTimeout(() => setLiveToastMessage(null), ms);
  };

  // Muat talent, ulasan, dan pengaturan website dari Supabase
  const loadData = async () => {
    setIsDataLoading(true);
    setDataError(null);
    try {
      const [t, r, s] = await Promise.all([db.fetchTalents(), db.fetchReviews(), db.fetchSiteSettings()]);
      setTalents(t);
      setReviews(r);
      setSiteSettings(s);
      reloadSchedules();
    } catch (e) {
      console.error('Gagal memuat data', e);
      setDataError(errorText(e));
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    // Bersihkan sisa data versi lama yang dulu disimpan di browser
    ['paradox_user_profile', 'paradox_talents_data', 'paradox_reviews_data', 'paradox_site_settings', 'paradox_liked_talents']
      .forEach((key) => localStorage.removeItem(key));
    loadData();
  }, []);

  // Pulihkan sesi login saat halaman dibuka, dan ikuti perubahan login/logout dari Supabase.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        return;
      }
      // User membuka link "reset kata sandi" dari email
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPasswordOpen(true);
      }
      if (event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
        const user = session.user;
        // Ditunda agar tidak memanggil Supabase di dalam callback auth (bisa deadlock).
        setTimeout(() => {
          loadAccount(user)
            .then(setCurrentUser)
            .catch((e) => console.error('Gagal memuat profil', e));
        }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Daftar like ikut akun yang login
  useEffect(() => {
    setLikedTalentIds(currentUser?.likedTalentIds ?? []);
  }, [currentUser]);

  // Ambil ulang daftar talent tanpa tampilan loading
  const reloadTalents = () =>
    db.fetchTalents()
      .then(setTalents)
      .catch((e) => console.error('Gagal memuat ulang talent', e));

  // Admin/talent bisa melihat talent yang belum tampil di publik, jadi muat ulang saat akun berganti
  const accountKey = currentUser ? `${currentUser.id}:${currentUser.role}:${currentUser.talentId ?? ''}` : 'guest';
  const isFirstAccountKey = React.useRef(true);
  useEffect(() => {
    if (isFirstAccountKey.current) {
      isFirstAccountKey.current = false;
      return;
    }
    reloadTalents();
  }, [accountKey]);

  // Real-time: status live, talent baru, dan perubahan profil langsung muncul tanpa refresh
  useEffect(() => {
    const unsubscribe = db.subscribeTalents({
      onUpsert: (t) =>
        setTalents((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev])),
      onDelete: (id) => setTalents((prev) => prev.filter((t) => t.id !== id))
    });

    // Saat tab dibuka lagi, sinkronkan ulang (misalnya ada talent yang disembunyikan selama tab tidak aktif)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reloadTalents();
        reloadSchedules();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Talent yang tidak lagi tampil di publik: tutup modal yang sedang membukanya (untuk pengunjung)
  useEffect(() => {
    const canSee = (t: Talent) => db.isPubliclyVisible(t) || currentUser?.role === 'admin' || t.id === currentUser?.talentId;
    if (selectedDetailTalent) {
      const t = talents.find((x) => x.id === selectedDetailTalent.id);
      if (!t || !canSee(t)) setSelectedDetailTalent(null);
    }
    if (selectedLiveTalent) {
      const t = talents.find((x) => x.id === selectedLiveTalent.id);
      if (!t || !canSee(t)) setSelectedLiveTalent(null);
      else if (t !== selectedLiveTalent) setSelectedLiveTalent(t);
    }
  }, [talents]);

  // Ambil ulang 1 talent (setelah verifikasi, sembunyikan, dll.)
  const refreshTalent = async (talentId: string) => {
    const t = await db.fetchTalent(talentId);
    setTalents((prev) =>
      t ? (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]) : prev.filter((x) => x.id !== talentId)
    );
  };

  // Hapus ulasan (admin atau penulisnya). Mengembalikan true kalau berhasil.
  const handleDeleteReview = async (reviewId: string): Promise<boolean> => {
    if (!confirm('Hapus ulasan ini?')) return false;
    const talentId = reviews.find((r) => r.id === reviewId)?.talentId;
    try {
      await db.deleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (talentId) await refreshTalent(talentId);
      return true;
    } catch (e) {
      alert(`Gagal menghapus ulasan: ${errorText(e)}`);
      return false;
    }
  };

  // Talent menyimpan profilnya sendiri
  const handleSaveOwnProfile = async (t: Talent) => {
    const saved = await db.updateOwnTalent(t);
    replaceTalent(saved);
  };

  // Talent menghapus profilnya sendiri; akunnya kembali jadi member biasa
  const handleDeleteOwnProfile = async (talentId: string) => {
    await db.deleteTalent(talentId);
    setTalents((prev) => prev.filter((t) => t.id !== talentId));
    setReviews((prev) => prev.filter((r) => r.talentId !== talentId));
    setIsBroadcastOpen(false);
    const { data } = await supabase.auth.getUser();
    if (data.user) setCurrentUser(await loadAccount(data.user));
    showToast('Profil talent Anda sudah dihapus.');
  };

  // Statistik: catat kunjungan profil (sekali per talent per sesi browser)
  useEffect(() => {
    if (selectedDetailTalent) db.recordTalentView(selectedDetailTalent.id);
  }, [selectedDetailTalent?.id]);

  // Keep selectedDetailTalent updated if talents change (e.g., likes or reviews)
  useEffect(() => {
    if (selectedDetailTalent) {
      const updated = talents.find((t) => t.id === selectedDetailTalent.id);
      if (updated) setSelectedDetailTalent(updated);
    }
  }, [talents]);

  const replaceTalent = (updated: Talent) =>
    setTalents((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const adjustLikeCount = (talentId: string, delta: number) =>
    setTalents((prev) =>
      prev.map((t) => (t.id === talentId ? { ...t, likesCount: Math.max(0, t.likesCount + delta) } : t))
    );

  // Like / Unlike: wajib login
  const handleToggleLike = async (talentId: string) => {
    if (!currentUser) {
      showToast('Silakan masuk dulu untuk menyukai talent.');
      setIsAuthOpen(true);
      return;
    }

    const willLike = !likedTalentIds.includes(talentId);

    // Update tampilan dulu supaya terasa cepat, lalu simpan ke database
    setLikedTalentIds((prev) => (willLike ? [...prev, talentId] : prev.filter((id) => id !== talentId)));
    adjustLikeCount(talentId, willLike ? 1 : -1);

    try {
      await db.setLike(currentUser.id, talentId, willLike);
    } catch (e) {
      // Batalkan perubahan tampilan kalau gagal
      setLikedTalentIds((prev) => (willLike ? prev.filter((id) => id !== talentId) : [...prev, talentId]));
      adjustLikeCount(talentId, willLike ? -1 : 1);
      showToast(`Gagal menyimpan like: ${errorText(e)}`);
    }
  };

  // Tambah / ganti ulasan: wajib login. Error dilempar ke form ulasan supaya bisa ditampilkan.
  const handleAddReview = async (talentId: string, rating: number, comment: string) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      throw new Error('Silakan masuk dulu untuk menulis ulasan.');
    }
    await db.saveReview(currentUser.id, talentId, rating, comment);

    // Rating rata-rata & jumlah ulasan dihitung database, jadi ambil ulang
    const [updatedReviews, updatedTalent] = await Promise.all([db.fetchReviews(), db.fetchTalent(talentId)]);
    setReviews(updatedReviews);
    if (updatedTalent) replaceTalent(updatedTalent);
  };

  const applyLiveState = (talentId: string, patch: Partial<Talent>) =>
    setTalents((prev) => prev.map((t) => (t.id === talentId ? { ...t, ...patch } : t)));

  // Talent starts live broadcast
  // Talent mulai live (dipanggil studio setelah kamera tersambung ke LiveKit). Error dilempar ke studio.
  const handleStartLive = async (talentId: string, title: string) => {
    await db.setTalentLive(talentId, true, { title, streamType: 'camera' });
    applyLiveState(talentId, {
      isLive: true,
      liveStatusText: 'Sedang Live Stream Sekarang',
      liveStreamTitle: title,
      liveStreamType: 'camera',
      liveHeartbeatAt: new Date().toISOString()
    });
    const name = talents.find((t) => t.id === talentId)?.name || 'Talent';
    showToast(`🔴 Siaran live ${name} dimulai! Pengunjung bisa langsung menonton.`, 5000);
  };

  // Talent mengakhiri live
  const handleStopLive = async (talentId: string) => {
    applyLiveState(talentId, { isLive: false, liveStatusText: 'Offline', liveHeartbeatAt: undefined });
    await db.setTalentLive(talentId, false);
    showToast('Siaran live telah dihentikan.', 3000);
  };

  // Admin save talent (Create or Update). Error dilempar ke panel admin.
  const handleSaveTalent = async (talent: Talent) => {
    const saved = await db.saveTalent(talent);
    setTalents((prev) =>
      prev.some((t) => t.id === saved.id) ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]
    );
  };

  // Admin delete talent
  const handleDeleteTalent = async (talentId: string) => {
    if (!confirm('Yakin ingin menghapus talent ini dari katalog? Semua ulasan & like-nya ikut terhapus.')) return;
    try {
      // Hapus akun login talent dulu (kalau fungsi belum di-deploy, lanjut saja)
      await db.removeTalentLogin(talentId).catch((e) => console.warn('Login talent tidak terhapus', e));
      await db.deleteTalent(talentId);
      setTalents((prev) => prev.filter((t) => t.id !== talentId));
      setReviews((prev) => prev.filter((r) => r.talentId !== talentId));
      if (selectedDetailTalent?.id === talentId) setSelectedDetailTalent(null);
      if (selectedLiveTalent?.id === talentId) setSelectedLiveTalent(null);
    } catch (e) {
      alert(`Gagal menghapus talent: ${errorText(e)}`);
    }
  };

  // Admin save site settings. Error dilempar ke panel admin.
  const handleSaveSiteSettings = async (newSettings: SiteSettings) => {
    await db.saveSiteSettings(newSettings);
    setSiteSettings(newSettings);
  };

  // Admin reset pengaturan website ke bawaan (data talent tidak disentuh)
  const handleResetDefault = async () => {
    if (!confirm('Kembalikan pengaturan website (brand, logo, teks, Telegram CS) ke bawaan awal PARADOX?')) return;
    try {
      await db.saveSiteSettings(DEFAULT_SITE_SETTINGS);
      setSiteSettings(DEFAULT_SITE_SETTINGS);
      showToast('Pengaturan website dikembalikan ke bawaan.');
    } catch (e) {
      alert(`Gagal reset pengaturan: ${errorText(e)}`);
    }
  };


  const liveTalentsCount = publicTalents.filter((t) => t.isLive).length;

  const scrollToCatalog = () => {
    const el = document.getElementById('katalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFilterLive = () => {
    setActiveFilterCategory('live');
    scrollToCatalog();
  };

  // Konfirmasi 18+ sebelum isi website ditampilkan
  if (!ageConfirmed) {
    return (
      <AgeGate
        brandName={siteSettings.brandName}
        logoUrl={siteSettings.logoUrl}
        onConfirm={() => setAgeConfirmed(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07080D] text-slate-100 flex flex-col font-sans selection:bg-red-500/30 selection:text-red-200">
      {/* Toast Notification */}
      {liveToastMessage && (
        <div className="fixed top-24 right-4 z-50 max-w-sm p-4 rounded-2xl bg-black/90 border border-red-500/80 text-white shadow-2xl flex items-center gap-3 backdrop-blur-md animate-fade-in">
          <Radio className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-semibold">{liveToastMessage}</span>
        </div>
      )}

      {/* Navigation Top Bar */}
      <Navbar
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={() => {
          setCurrentUser(null);
          signOut();
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenProfile={() => {
          if (myTalent) setIsProfileOpen(true);
          else showToast('Akun Anda belum terhubung ke profil talent. Hubungi admin.');
        }}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenBroadcast={() => {
          if (currentUser?.role === 'talent') {
            if (!myTalent) {
              showToast('Akun Anda belum terhubung ke profil talent. Hubungi admin.');
              return;
            }
            setBroadcastInitialTalent(myTalent);
            setIsBroadcastOpen(true);
          } else if (currentUser?.role === 'admin') {
            setBroadcastInitialTalent(talents.find((t) => t.isLive) || talents[0]);
            setIsBroadcastOpen(true);
          } else {
            setIsAuthOpen(true);
          }
        }}
        activeFilter={activeFilterCategory}
        onSelectCategory={(cat) => setActiveFilterCategory(cat)}
        liveCount={liveTalentsCount}
        siteSettings={siteSettings}
      />

      {/* Hero Section */}
      <main className="flex-1">
        <Hero
          onExploreCatalog={scrollToCatalog}
          onFilterLive={handleFilterLive}
          liveCount={liveTalentsCount}
          siteSettings={siteSettings}
        />

        {(isDataLoading || dataError) && (
          <div className="max-w-3xl mx-auto px-4 pt-10">
            {isDataLoading ? (
              <p className="text-center text-sm text-slate-400">Memuat katalog talent...</p>
            ) : (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>Gagal memuat data dari server: {dataError}</span>
                <button
                  onClick={loadData}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  Coba Lagi
                </button>
              </div>
            )}
          </div>
        )}

        {/* Talent Catalog with Filter & Search */}
        <UpcomingLives
          talents={publicTalents}
          schedules={schedules}
          onOpenDetail={(talent) => setSelectedDetailTalent(talent)}
        />

        <CatalogSection
          talents={publicTalents}
          onOpenDetail={(talent) => setSelectedDetailTalent(talent)}
          onOpenLive={(talent) => setSelectedLiveTalent(talent)}
          onToggleLike={handleToggleLike}
          likedTalentIds={likedTalentIds}
          brandName={siteSettings.brandName}
        />

        {/* Telegram Direct Booking Guide */}
        <BookingGuide siteSettings={siteSettings} />
      </main>

      {/* Footer */}
      <Footer siteSettings={siteSettings} />

      {/* Detail & Multi-Media Slider Modal */}
      {selectedDetailTalent && (
        <TalentDetailModal
          talent={selectedDetailTalent}
          reviews={reviews}
          onClose={() => setSelectedDetailTalent(null)}
          onToggleLike={handleToggleLike}
          isLiked={likedTalentIds.includes(selectedDetailTalent.id)}
          currentUser={currentUser}
          onAddReview={handleAddReview}
          onOpenLive={(t) => {
            setSelectedDetailTalent(null);
            setSelectedLiveTalent(t);
          }}
          brandName={siteSettings.brandName}
          onReport={setReportTarget}
          onDeleteReview={handleDeleteReview}
          schedules={schedules.filter((s) => s.talentId === selectedDetailTalent.id)}
        />
      )}

      {/* Live Stream Showcase Modal (Spectator Room) */}
      {selectedLiveTalent && (
        <React.Suspense fallback={null}>
        <LiveShowcaseModal
          talent={talentsView.find((t) => t.id === selectedLiveTalent.id) ?? selectedLiveTalent}
          onClose={() => setSelectedLiveTalent(null)}
          onOpenDetail={(t) => {
            setSelectedLiveTalent(null);
            setSelectedDetailTalent(t);
          }}
          onToggleLike={handleToggleLike}
          isLiked={likedTalentIds.includes(selectedLiveTalent.id)}
          brandName={siteSettings.brandName}
          canChat={Boolean(currentUser)}
          myName={currentUser?.name}
          onRequestLogin={() => setIsAuthOpen(true)}
          isModerator={currentUser?.role === 'admin' || currentUser?.talentId === selectedLiveTalent.id}
        />
        </React.Suspense>
      )}

      {/* Talent Go Live Broadcast Studio Modal (Talent / Admin Broadcaster) */}
      {isBroadcastOpen && (
        <React.Suspense fallback={null}>
        <LiveBroadcastModal
          talents={talents}
          initialTalent={broadcastInitialTalent}
          isTalentHost={currentUser?.role === 'talent'}
          onClose={() => {
            setIsBroadcastOpen(false);
            setBroadcastInitialTalent(undefined);
          }}
          onStartLive={handleStartLive}
          onStopLive={handleStopLive}
        />
        </React.Suspense>
      )}

      {/* Login & Register Modal with Dedicated Talent Host Tab */}
      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={async (user) => {
            setCurrentUser(user);
            if (user.role === 'talent') {
              // Profil talent bisa saja belum tampil di publik, jadi ambil langsung sebagai talent yang login
              const own = user.talentId ? await db.fetchTalent(user.talentId).catch(() => null) : null;
              if (!own) {
                showToast('Akun Anda belum terhubung ke profil talent. Hubungi admin.', 5000);
                return;
              }
              setTalents((prev) => (prev.some((t) => t.id === own.id) ? prev.map((t) => (t.id === own.id ? own : t)) : [own, ...prev]));
              setBroadcastInitialTalent(own);
              setIsBroadcastOpen(true);
              showToast(`🔴 Selamat datang, ${user.name}! Studio live Anda siap digunakan.`, 5000);
            } else if (user.role === 'admin') {
              showToast(`Selamat datang, Admin! Anda memiliki akses penuh ke Admin Studio.`);
            } else {
              showToast(`Selamat datang, ${user.name}! Status VIP Anda aktif.`);
            }
          }}
        />
      )}

      {/* Admin Panel Modal with Complete Site Settings & Talent Management */}
      {isAdminOpen && (
        <AdminPanelModal
          talents={talents}
          siteSettings={siteSettings}
          onClose={() => {
            setIsAdminOpen(false);
            reloadSchedules();
          }}
          onSaveTalent={handleSaveTalent}
          onDeleteTalent={handleDeleteTalent}
          onResetDefaultTalents={handleResetDefault}
          onSaveSiteSettings={handleSaveSiteSettings}
          onOpenBroadcastForTalent={(talent) => {
            setIsAdminOpen(false);
            setBroadcastInitialTalent(talent);
            setIsBroadcastOpen(true);
          }}
          reviews={reviews}
          onDeleteReview={handleDeleteReview}
          onTalentChanged={refreshTalent}
        />
      )}

      {/* Profil Saya (khusus talent) */}
      {isProfileOpen && myTalent && (
        <TalentProfileModal
          talent={myTalent}
          onClose={() => {
            setIsProfileOpen(false);
            reloadSchedules();
          }}
          onSave={handleSaveOwnProfile}
          onDelete={handleDeleteOwnProfile}
        />
      )}

      {/* Akun Saya: ganti nama, unduh data, hapus akun */}
      {isAccountOpen && currentUser && (
        <AccountModal
          user={currentUser}
          onClose={() => setIsAccountOpen(false)}
          onNameChanged={(name) => setCurrentUser({ ...currentUser, name, likedTalentIds })}
          onDeleted={() => {
            setIsAccountOpen(false);
            setCurrentUser(null);
            signOut();
            loadData();
            showToast('Akun Anda sudah dihapus. Terima kasih sudah berkunjung.');
          }}
        />
      )}

      {/* Laporkan profil / ulasan */}
      {reportTarget && <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />}

      {/* Ajakan install website sebagai aplikasi di HP */}
      <InstallPrompt brandName={siteSettings.brandName} />

      {/* Buat kata sandi baru setelah membuka link reset dari email */}
      {isResetPasswordOpen && <ResetPasswordModal onDone={() => setIsResetPasswordOpen(false)} />}
    </div>
  );
}
