import { Talent, Review, SiteSettings } from '../types/talent';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brandName: 'PARADOX',
  brandTagline: 'VIP Talent & Nightlife Agency',
  logoUrl: '/assets/aistudio/photo_2026-02-11_13-05-01_ed7e07ca.jpg',
  officialTelegramUsername: 'csparadox_bot',
  officialTelegramUrl: 'https://t.me/csparadox_bot',
  heroHeadline: 'Koleksi Talent Eksklusif Terkoneksi Langsung ke Telegram Pribadi',
  heroSubtitle: 'Temukan talent model, VIP dinner mate, party companion, dan live session terpercaya. Lengkap dengan foto, video reel asli, serta ulasan terpercaya member.',
  heroAnnouncement: 'PARADOX VIP Nightlife & Talent Agency · Direct Telegram Verified',
  accentStyle: 'crimson',
  disclaimerText: 'Pemberitahuan Khusus Dewasa (18+): Semua talent yang terdaftar di PARADOX telah diverifikasi berusia 18 tahun ke atas. Komunikasi dan kesepakatan berlangsung langsung antara klien dan talent melalui aplikasi Telegram. Jaga etika dan privasi bersama.',
  supportHeading: 'Butuh Rekomendasi Talent Tertentu atau Tanya Tarif Paket VIP?',
  supportSubtext: 'Customer support PARADOX standby setiap hari untuk reservasi grup, yacht trip, dan private event.'
};

export const INITIAL_TALENTS: Talent[] = [
  {
    id: 'talent-1',
    name: 'Valerie Anastasya',
    alias: 'Valerie Queen',
    city: 'Jakarta',
    age: 23,
    height: 168,
    weight: 49,
    braSize: '34C',
    isLive: true,
    liveStatusText: 'Sedang Live Stream & Siap Chat',
    telegramUsername: 'valerie_paradox_vip',
    telegramPhone: '+6281234567890',
    bio: 'Model runway dan high-fashion enthusiast. Berpengalaman menemani jamuan VIP dinner formal, rooftop party, maupun private photoshoot elegan.',
    zodiac: 'Scorpio',
    languages: ['Indonesia', 'English (Fluent)'],
    services: ['VIP Dinner Companion', 'Private Party Host', 'Photoshoot Model', 'Nightclub Table Mate'],
    rates: {
      dinnerDate: 'Rp 2.500.000 / 3 Jam',
      vipParty: 'Rp 4.500.000 / Malam',
      photoshoot: 'Rp 1.800.000 / Sesi'
    },
    media: [
      {
        id: 'val-1',
        type: 'image',
        url: '/src/assets/images/talent_model_valerie_1794207018750.jpg',
        title: 'Emerald Gown Portrait'
      },
      {
        id: 'val-vid-1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail: '/src/assets/images/talent_model_valerie_1794207018750.jpg',
        title: 'VIP Lounge Video Greeting'
      },
      {
        id: 'val-2',
        type: 'image',
        url: '/src/assets/images/talent_model_amanda_1794207019628.jpg',
        title: 'Glamour Cocktail Look'
      }
    ],
    likesCount: 348,
    ratingAverage: 4.9,
    reviewsCount: 28,
    verified: true,
    featured: true
  },
  {
    id: 'talent-2',
    name: 'Amanda Chyntia',
    alias: 'Manda Velvet',
    city: 'Bali',
    age: 22,
    height: 165,
    weight: 48,
    braSize: '34B',
    isLive: true,
    liveStatusText: 'Online di Seminyak Lounge',
    telegramUsername: 'amanda_paradox_vip',
    telegramPhone: '+6281298765432',
    bio: 'Ramah, supel, dan selalu membawa energi ceria. Siap mendampingi liburan santai di beach club Bali, sunset yacht cruise, hingga private clubbing.',
    zodiac: 'Leo',
    languages: ['Indonesia', 'English', 'Mandarin Basic'],
    services: ['Beach Club Companion', 'Yacht Trip Mate', 'Dinner Date', 'Clubbing Buddy'],
    rates: {
      dinnerDate: 'Rp 2.800.000 / 3 Jam',
      vipParty: 'Rp 5.000.000 / Malam',
      photoshoot: 'Rp 2.000.000 / Sesi'
    },
    media: [
      {
        id: 'manda-1',
        type: 'image',
        url: '/src/assets/images/talent_model_amanda_1794207019628.jpg',
        title: 'Velvet Green Club Look'
      },
      {
        id: 'manda-vid-1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnail: '/src/assets/images/talent_model_amanda_1794207019628.jpg',
        title: 'Video Teaser Bali Trip'
      },
      {
        id: 'manda-2',
        type: 'image',
        url: '/src/assets/images/talent_model_giselle_1794207019101.jpg',
        title: 'Night Glow Outfit'
      }
    ],
    likesCount: 412,
    ratingAverage: 5.0,
    reviewsCount: 36,
    verified: true,
    featured: true
  },
  {
    id: 'talent-3',
    name: 'Giselle Clarissa',
    alias: 'Giselle Noir',
    city: 'Surabaya',
    age: 24,
    height: 171,
    weight: 52,
    braSize: '36C',
    isLive: false,
    liveStatusText: 'Offline (Kembali 20:00 WIB)',
    telegramUsername: 'giselle_paradox_vip',
    telegramPhone: '+6281311223344',
    bio: 'Tinggi proporsional dengan aura elegan mewah. Sangat mahir dalam obrolan bisnis, wine tasting, serta mendampingi acara eksklusif kelas atas.',
    zodiac: 'Libra',
    languages: ['Indonesia', 'English'],
    services: ['Executive Business Dinner', 'Gala Night Escort', 'Cocktail Lounge Host', 'VIP Meetup'],
    rates: {
      dinnerDate: 'Rp 3.000.000 / 3 Jam',
      vipParty: 'Rp 5.500.000 / Malam',
      photoshoot: 'Rp 2.200.000 / Sesi'
    },
    media: [
      {
        id: 'gis-1',
        type: 'image',
        url: '/src/assets/images/talent_model_giselle_1794207019101.jpg',
        title: 'Black Sequin Glamour'
      },
      {
        id: 'gis-vid-1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnail: '/src/assets/images/talent_model_giselle_1794207019101.jpg',
        title: 'Behind The Scenes Clip'
      },
      {
        id: 'gis-2',
        type: 'image',
        url: '/src/assets/images/talent_model_valerie_1794207018750.jpg',
        title: 'Gala Night Dress'
      }
    ],
    likesCount: 289,
    ratingAverage: 4.8,
    reviewsCount: 22,
    verified: true,
    featured: false
  },
  {
    id: 'talent-4',
    name: 'Natasha Kimberly',
    alias: 'Natasha Sweet',
    city: 'Bandung',
    age: 21,
    height: 162,
    weight: 46,
    braSize: '32B',
    isLive: true,
    liveStatusText: 'Sedang Live Stream & Aktif',
    telegramUsername: 'natasha_paradox_vip',
    telegramPhone: '+6281722334455',
    bio: 'Cute, manis, dan berwajah oriental. Sangat cocok untuk cafe hopping santai, karaoke private room, dan nonton film bersama.',
    zodiac: 'Gemini',
    languages: ['Indonesia', 'Sunda', 'English'],
    services: ['Private Cafe Hopping', 'Karaoke Partner', 'Movie Date Companion', 'Weekend Trip'],
    rates: {
      dinnerDate: 'Rp 2.000.000 / 3 Jam',
      vipParty: 'Rp 3.800.000 / Malam',
      photoshoot: 'Rp 1.500.000 / Sesi'
    },
    media: [
      {
        id: 'nat-1',
        type: 'image',
        url: '/src/assets/images/talent_model_amanda_1794207019628.jpg',
        title: 'Sweet Velvet Glam'
      },
      {
        id: 'nat-vid-1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail: '/src/assets/images/talent_model_amanda_1794207019628.jpg',
        title: 'Bandung Chill Greeting'
      },
      {
        id: 'nat-2',
        type: 'image',
        url: '/src/assets/images/talent_model_giselle_1794207019101.jpg',
        title: 'Casual Chic Night'
      }
    ],
    likesCount: 512,
    ratingAverage: 4.95,
    reviewsCount: 41,
    verified: true,
    featured: true
  },
  {
    id: 'talent-5',
    name: 'Chelsea Caroline',
    alias: 'Chelsea Chic',
    city: 'Jakarta',
    age: 25,
    height: 169,
    weight: 51,
    braSize: '36D',
    isLive: false,
    liveStatusText: 'Standby untuk Booking Besok',
    telegramUsername: 'chelsea_paradox_vip',
    telegramPhone: '+6281899887766',
    bio: 'Model bervolume elegan dengan postur menawan. Berkelas, sopan, dan mengerti tata krama VIP lounge maupun high-society dining.',
    zodiac: 'Taurus',
    languages: ['Indonesia', 'English'],
    services: ['VIP Clubbing Host', 'Luxury Yachting', 'Private Meetup', 'Nightlife Guide'],
    rates: {
      dinnerDate: 'Rp 3.200.000 / 3 Jam',
      vipParty: 'Rp 6.000.000 / Malam',
      photoshoot: 'Rp 2.500.000 / Sesi'
    },
    media: [
      {
        id: 'che-1',
        type: 'image',
        url: '/src/assets/images/talent_model_valerie_1794207018750.jpg',
        title: 'VIP Lounge Exclusive'
      },
      {
        id: 'che-2',
        type: 'image',
        url: '/src/assets/images/talent_model_amanda_1794207019628.jpg',
        title: 'Golden Glow Evening'
      }
    ],
    likesCount: 377,
    ratingAverage: 4.85,
    reviewsCount: 19,
    verified: true,
    featured: false
  },
  {
    id: 'talent-6',
    name: 'Stefanie Angelina',
    alias: 'Stefi Gold',
    city: 'Bali',
    age: 23,
    height: 167,
    weight: 50,
    braSize: '34C',
    isLive: true,
    liveStatusText: 'Live dari Canggu Villa',
    telegramUsername: 'stefanie_canggu_vip',
    telegramPhone: '+6281988776655',
    bio: 'Eksotis, enerjik, dan hobi musik elektronik / DJ. Selalu jadi pusat perhatian di setiap pesta pantai dan festival musik.',
    zodiac: 'Aries',
    languages: ['Indonesia', 'English Fluent'],
    services: ['Beach Club VIP Host', 'Music Festival Mate', 'Luxury Dining', 'After Party Guide'],
    rates: {
      dinnerDate: 'Rp 2.700.000 / 3 Jam',
      vipParty: 'Rp 4.800.000 / Malam',
      photoshoot: 'Rp 1.900.000 / Sesi'
    },
    media: [
      {
        id: 'ste-1',
        type: 'image',
        url: '/src/assets/images/talent_model_giselle_1794207019101.jpg',
        title: 'Shimmering Night Look'
      },
      {
        id: 'ste-vid-1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnail: '/src/assets/images/talent_model_giselle_1794207019101.jpg',
        title: 'Canggu Sunset Party Clip'
      },
      {
        id: 'ste-2',
        type: 'image',
        url: '/src/assets/images/talent_model_valerie_1794207018750.jpg',
        title: 'Cocktail Gala Elegance'
      }
    ],
    likesCount: 462,
    ratingAverage: 4.9,
    reviewsCount: 31,
    verified: true,
    featured: true
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    talentId: 'talent-1',
    userName: 'David W. (VIP Member)',
    rating: 5,
    comment: 'Valerie sangat profesional dan anggun saat dinner formal di SCBD. Obrolannya nyambung banget dan membuat rekan bisnis saya terkesan. Fast response di Telegram!',
    createdAt: '2 hari yang lalu',
    isVerifiedClient: true
  },
  {
    id: 'rev-2',
    talentId: 'talent-1',
    userName: 'Kurniawan S.',
    rating: 5,
    comment: 'Pasti repeat order. Orangnya tepat waktu, wangi, penampilannya bahkan lebih memukau dari foto di katalog.',
    createdAt: '5 hari yang lalu',
    isVerifiedClient: true
  },
  {
    id: 'rev-3',
    talentId: 'talent-2',
    userName: 'Reza Hendra',
    rating: 5,
    comment: 'Amanda asyik banget nemenin party di Atlas Beach Club Bali! Vibe-nya ceria dan ramah, kontak via Telegram langsung direspon dalam 3 menit.',
    createdAt: 'Kemarin',
    isVerifiedClient: true
  },
  {
    id: 'rev-4',
    talentId: 'talent-2',
    userName: 'Michael Tan',
    rating: 5,
    comment: 'Cantik banget, tinggi dan postur persis sesuai deskripsi di web (TB 165 BB 48). Recommended talent!',
    createdAt: '1 minggu yang lalu',
    isVerifiedClient: true
  },
  {
    id: 'rev-5',
    talentId: 'talent-3',
    userName: 'Arthur P.',
    rating: 5,
    comment: 'Giselle sosok yang sangat berkelas di Surabaya. Sangat paham wine etiquette dan suasana restoran fine dining.',
    createdAt: '3 hari yang lalu',
    isVerifiedClient: true
  },
  {
    id: 'rev-6',
    talentId: 'talent-4',
    userName: 'Bimo S.',
    rating: 5,
    comment: 'Natasha ramah dan manis banget. Senyumnya bikin betah ngobrol berjam-jam.',
    createdAt: 'Kemarin',
    isVerifiedClient: true
  }
];

export const AGENCY_CS_TELEGRAM = 'csparadox_bot';
export const HERO_BG_IMAGE = '/src/assets/images/hero_vip_nightlife_1794207019314.jpg';
