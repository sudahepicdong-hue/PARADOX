export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  title?: string;
}

export interface Review {
  id: string;
  talentId: string;
  userId?: string;
  userName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  isVerifiedClient?: boolean;
}

export interface Talent {
  id: string;
  name: string;
  alias: string;
  city?: string;
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
  braSize?: string;
  isLive: boolean;
  liveStatusText?: string;
  telegramUsername: string; // e.g. "valerie_clubsnight"
  telegramPhone?: string;
  bio: string;
  zodiac: string;
  languages: string[];
  services: string[];
  rates: {
    dinnerDate?: string;
    vipParty?: string;
    photoshoot?: string;
  };
  media: MediaItem[];
  likesCount: number;
  ratingAverage: number;
  reviewsCount: number;
  verified: boolean;
  featured?: boolean;
  liveStreamTitle?: string;
  liveStreamType?: 'camera' | 'video' | 'custom_url';
  liveStreamUrl?: string;
  liveViewersCount?: number;
  isActive?: boolean; // false = disembunyikan dari katalog
  idVerifiedAt?: string; // diisi setelah admin memverifikasi dokumen identitas 18+
  liveHeartbeatAt?: string; // terakhir kali browser talent memberi tanda masih siaran
}

export interface TalentDocument {
  id: string;
  talentId: string;
  docType: 'ktp' | 'paspor' | 'sim' | 'lainnya';
  birthDate: string; // YYYY-MM-DD
  storagePath: string;
  createdAt: string;
}

export type ReportReason = 'underage' | 'coercion' | 'fake' | 'inappropriate' | 'spam' | 'other';

export interface Report {
  id: string;
  targetType: 'talent' | 'review';
  talentId?: string;
  reviewId?: string;
  reason: ReportReason;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface UserAccount {
  id: string;
  name: string;
  emailOrPhone: string;
  role: 'user' | 'talent' | 'admin';
  talentId?: string; // Linked talent ID if role === 'talent'
  likedTalentIds: string[];
}

export interface SiteSettings {
  brandName: string;
  brandTagline: string;
  logoUrl: string;
  officialTelegramUsername: string;
  officialTelegramUrl: string;
  heroHeadline: string;
  heroSubtitle: string;
  heroAnnouncement: string;
  accentStyle: 'crimson' | 'gold';
  disclaimerText: string;
  supportHeading: string;
  supportSubtext: string;
}
