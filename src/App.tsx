import React, { useState, useEffect } from 'react';
import { Talent, Review, UserAccount, SiteSettings } from './types/talent';
import { INITIAL_TALENTS, INITIAL_REVIEWS, DEFAULT_SITE_SETTINGS } from './data/initialTalents';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CatalogSection } from './components/CatalogSection';
import { TalentDetailModal } from './components/TalentDetailModal';
import { LiveShowcaseModal } from './components/LiveShowcaseModal';
import { LiveBroadcastModal } from './components/LiveBroadcastModal';
import { AuthModal } from './components/AuthModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { BookingGuide } from './components/BookingGuide';
import { Footer } from './components/Footer';
import { Radio, Sparkles } from 'lucide-react';

export default function App() {
  // Load site settings (PARADOX, Logo, Official Telegram CS, etc.)
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const saved = localStorage.getItem('paradox_site_settings');
      if (saved) return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error loading site settings', e);
    }
    return DEFAULT_SITE_SETTINGS;
  });

  // Load talents from LocalStorage or use INITIAL_TALENTS
  const [talents, setTalents] = useState<Talent[]>(() => {
    try {
      const saved = localStorage.getItem('paradox_talents_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading talents from localStorage', e);
    }
    return INITIAL_TALENTS;
  });

  // Load reviews from LocalStorage or use INITIAL_REVIEWS
  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const saved = localStorage.getItem('paradox_reviews_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading reviews from localStorage', e);
    }
    return INITIAL_REVIEWS;
  });

  // Load current user
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('paradox_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading user profile', e);
    }
    return null;
  });

  // Liked talents by this client
  const [likedTalentIds, setLikedTalentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('paradox_liked_talents');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading likes', e);
    }
    return ['talent-1', 'talent-2'];
  });

  // Modals state
  const [selectedDetailTalent, setSelectedDetailTalent] = useState<Talent | null>(null);
  const [selectedLiveTalent, setSelectedLiveTalent] = useState<Talent | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState<boolean>(false);
  const [broadcastInitialTalent, setBroadcastInitialTalent] = useState<Talent | undefined>(undefined);
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>('all');
  const [liveToastMessage, setLiveToastMessage] = useState<string | null>(null);

  // Sync states to LocalStorage
  useEffect(() => {
    localStorage.setItem('paradox_site_settings', JSON.stringify(siteSettings));
  }, [siteSettings]);

  useEffect(() => {
    localStorage.setItem('paradox_talents_data', JSON.stringify(talents));
  }, [talents]);

  useEffect(() => {
    localStorage.setItem('paradox_reviews_data', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('paradox_user_profile', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('paradox_user_profile');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('paradox_liked_talents', JSON.stringify(likedTalentIds));
  }, [likedTalentIds]);

  // Keep selectedDetailTalent updated if talents change (e.g., likes or reviews)
  useEffect(() => {
    if (selectedDetailTalent) {
      const updated = talents.find((t) => t.id === selectedDetailTalent.id);
      if (updated) setSelectedDetailTalent(updated);
    }
  }, [talents]);

  // Like / Unlike handler
  const handleToggleLike = (talentId: string) => {
    const isCurrentlyLiked = likedTalentIds.includes(talentId);

    setLikedTalentIds((prev) =>
      isCurrentlyLiked ? prev.filter((id) => id !== talentId) : [...prev, talentId]
    );

    setTalents((prev) =>
      prev.map((t) => {
        if (t.id === talentId) {
          const delta = isCurrentlyLiked ? -1 : 1;
          return {
            ...t,
            likesCount: Math.max(0, t.likesCount + delta)
          };
        }
        return t;
      })
    );
  };

  // Add review handler
  const handleAddReview = (talentId: string, rating: number, comment: string) => {
    const authorName = currentUser?.name || 'Klien VIP (Guest)';
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      talentId,
      userName: authorName,
      rating,
      comment,
      createdAt: 'Baru saja',
      isVerifiedClient: true
    };

    const updatedReviews = [newRev, ...reviews];
    setReviews(updatedReviews);

    // Recalculate average rating for this talent
    const talentSpecificReviews = updatedReviews.filter((r) => r.talentId === talentId);
    const sumRatings = talentSpecificReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAverage = sumRatings / talentSpecificReviews.length;

    setTalents((prev) =>
      prev.map((t) => {
        if (t.id === talentId) {
          return {
            ...t,
            ratingAverage: Number(newAverage.toFixed(2)),
            reviewsCount: talentSpecificReviews.length
          };
        }
        return t;
      })
    );
  };

  // Talent starts live broadcast
  const handleStartLive = (
    talentId: string,
    title: string,
    streamType: 'camera' | 'video',
    customUrl?: string
  ) => {
    setTalents((prev) =>
      prev.map((t) => {
        if (t.id === talentId) {
          return {
            ...t,
            isLive: true,
            liveStatusText: 'Sedang Live Stream Sekarang',
            liveStreamTitle: title,
            liveStreamType: streamType,
            liveStreamUrl: customUrl || t.liveStreamUrl,
            liveViewersCount: (t.liveViewersCount || 100) + 15
          };
        }
        return t;
      })
    );

    const talentObj = talents.find((t) => t.id === talentId);
    setLiveToastMessage(
      `🔴 Siaran Live ${talentObj?.name || 'Talent'} telah dimulai! Pengunjung dapat langsung menonton di katalog.`
    );
    setTimeout(() => setLiveToastMessage(null), 5000);
  };

  // Talent stops live broadcast
  const handleStopLive = (talentId: string) => {
    setTalents((prev) =>
      prev.map((t) => {
        if (t.id === talentId) {
          return {
            ...t,
            isLive: false,
            liveStatusText: 'Offline'
          };
        }
        return t;
      })
    );
    setLiveToastMessage('Siaran live telah dihentikan.');
    setTimeout(() => setLiveToastMessage(null), 3000);
  };

  // Admin save talent (Create or Update)
  const handleSaveTalent = (savedTalent: Talent) => {
    setTalents((prev) => {
      const exists = prev.some((t) => t.id === savedTalent.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTalent.id ? savedTalent : t));
      }
      return [savedTalent, ...prev];
    });
  };

  // Admin delete talent
  const handleDeleteTalent = (talentId: string) => {
    if (confirm('Yakin ingin menghapus talent ini dari katalog?')) {
      setTalents((prev) => prev.filter((t) => t.id !== talentId));
      if (selectedDetailTalent?.id === talentId) setSelectedDetailTalent(null);
      if (selectedLiveTalent?.id === talentId) setSelectedLiveTalent(null);
    }
  };

  // Admin save site settings
  const handleSaveSiteSettings = (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
  };

  // Admin reset data to default
  const handleResetDefault = () => {
    if (confirm('Kembalikan semua data talent & pengaturan ke bawaan awal PARADOX?')) {
      setTalents(INITIAL_TALENTS);
      setReviews(INITIAL_REVIEWS);
      setSiteSettings(DEFAULT_SITE_SETTINGS);
      localStorage.removeItem('paradox_talents_data');
      localStorage.removeItem('paradox_reviews_data');
      localStorage.removeItem('paradox_site_settings');
    }
  };

  const liveTalentsCount = talents.filter((t) => t.isLive).length;

  const scrollToCatalog = () => {
    const el = document.getElementById('katalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFilterLive = () => {
    setActiveFilterCategory('live');
    scrollToCatalog();
  };

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
        onLogout={() => setCurrentUser(null)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenBroadcast={() => {
          if (currentUser?.role === 'talent') {
            const myTalent = talents.find((t) => t.id === currentUser.talentId) || talents[0];
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

        {/* Talent Catalog with Filter & Search */}
        <CatalogSection
          talents={talents}
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
        />
      )}

      {/* Live Stream Showcase Modal (Spectator Room) */}
      {selectedLiveTalent && (
        <LiveShowcaseModal
          talent={selectedLiveTalent}
          onClose={() => setSelectedLiveTalent(null)}
          onOpenDetail={(t) => {
            setSelectedLiveTalent(null);
            setSelectedDetailTalent(t);
          }}
          onToggleLike={handleToggleLike}
          isLiked={likedTalentIds.includes(selectedLiveTalent.id)}
          brandName={siteSettings.brandName}
        />
      )}

      {/* Talent Go Live Broadcast Studio Modal (Talent / Admin Broadcaster) */}
      {isBroadcastOpen && (
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
      )}

      {/* Login & Register Modal with Dedicated Talent Host Tab */}
      {isAuthOpen && (
        <AuthModal
          talents={talents}
          onClose={() => setIsAuthOpen(false)}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            if (user.role === 'talent') {
              const myTalent = talents.find((t) => t.id === user.talentId) || talents[0];
              setBroadcastInitialTalent(myTalent);
              setIsBroadcastOpen(true);
              setLiveToastMessage(`🔴 Selamat datang, ${user.name}! Studio live streaming Anda siap digunakan.`);
              setTimeout(() => setLiveToastMessage(null), 5000);
            } else if (user.role === 'admin') {
              setLiveToastMessage(`Selamat datang, Admin! Anda memiliki akses penuh ke Admin Studio.`);
              setTimeout(() => setLiveToastMessage(null), 4000);
            } else {
              setLiveToastMessage(`Selamat datang, ${user.name}! Status VIP Anda aktif.`);
              setTimeout(() => setLiveToastMessage(null), 4000);
            }
          }}
        />
      )}

      {/* Admin Panel Modal with Complete Site Settings & Talent Management */}
      {isAdminOpen && (
        <AdminPanelModal
          talents={talents}
          siteSettings={siteSettings}
          onClose={() => setIsAdminOpen(false)}
          onSaveTalent={handleSaveTalent}
          onDeleteTalent={handleDeleteTalent}
          onResetDefaultTalents={handleResetDefault}
          onSaveSiteSettings={handleSaveSiteSettings}
          onOpenBroadcastForTalent={(talent) => {
            setIsAdminOpen(false);
            setBroadcastInitialTalent(talent);
            setIsBroadcastOpen(true);
          }}
        />
      )}
    </div>
  );
}
