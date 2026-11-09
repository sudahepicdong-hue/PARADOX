# Landing Page Katalog Talent Eksklusif & Integrasi Telegram

Platform web katalog talent nightlife eksklusif dan interaktif yang terinspirasi dari referensi Clubsnight, menghubungkan pengunjung secara langsung ke akun Telegram masing-masing talent dengan status Live real-time, slider multimedia foto/video, spesifikasi fisik lengkap, fitur interaksi ulasan/rating/like, serta manajemen pengguna dan admin.

## User Review & Critical Decisions

> [!IMPORTANT]
> Konfirmasi keputusan kunci berdasarkan preferensi pengguna:
> - **Arah Visual & Nuansa**: Dark luxury elegan dengan dominasi warna obsidian/charcoal, aksen emas berkilau (*gold luxury*), dan sentuhan neon violet modern.
> - **Integrasi Telegram & Fitur Live**: Setiap talent memiliki tautan Telegram langsung (`t.me/...`) yang memuat format pesan otomatis (nama talent, kode booking/konsultasi), disertai badge status Live (Online, Sedang Live, Offline) dengan filter khusus talent yang sedang aktif.
> - **Autentikasi & Otorisasi**: Sistem Login & Register terintegrasi bagi pengunjung untuk memberikan rating, komentar/ulasan, dan menyukai (*like*) profil talent favorit, serta dashboard Admin untuk mengelola data talent (tambah/edit talent, update status Live, kelola galeri).

- **Confirmed Decision 1**: Desain dark luxury elegan dengan tema warna canvas gelap pekat, aksen gold `#D4AF37` dan neon ungu `#A855F7`.
- **Confirmed Decision 2**: Integrasi Telegram per talent dengan tombol satu klik ("Chat Telegram") yang membuka obrolan langsung beserta template pesan booking.
- **Confirmed Decision 3**: Fitur Live interaktif mencakup filter "Sedang Live", preview live session, dan status real-time.
- **Confirmed Decision 4**: Data talent memuat spesifikasi fisik lengkap: Size BH, Tinggi Badan (TB cm), Berat Badan (BB kg), usia, domisili/kota, tarif estimasi/layanan, dan slider multimedia foto + video.
- **Confirmed Decision 5**: Sistem Login/Register untuk user dan mode Admin untuk pengelolaan data talent, tersimpan secara persisten melalui local storage client dengan sample data kaya dan realistis.

---

## 1. Overview & Core Concept

- **What It Does**: Landing page dan katalog talent premium yang menyajikan profil talent terverifikasi, galeri foto & video carousel, spesifikasi fisik terperinci (Size BH, TB, BB), indikator aktivitas Live, direct connect ke Telegram talent individual, serta sistem interaksi ulasan, bintang rating, dan like.
- **Target Audience / Persona**: Pengunjung dan klien nightlife VIP yang mencari talent profesional, model event, photoshoot, teman pesta, maupun sesi privat eksklusif dengan jalur komunikasi cepat dan aman via Telegram.
- **Key Value**: Akses instan tanpa perantara rumit, transparansi profil dan spesifikasi talent, pengalaman visual glamor dan responsif di desktop maupun smartphone.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Pendaratan & Hero Showcase**: Pengunjung disambut dengan banner sinematik dark luxury, headline megah, ringkasan talenta unggulan (*Featured Talents*), dan filter cepat berdasarkan kota serta status Live.
2. **Eksplorasi Katalog & Filtering**: Pengunjung menyaring talent berdasarkan lokasi (Jakarta, Bali, Surabaya, Bandung), kategori, status Live, rentang ukuran fisik (Size BH, TB, BB), atau mencari berdasarkan nama talent.
3. **Detail Talent & Media Slider**: Membuka profil talent menampilkan modal interaktif beresolusi tinggi dengan carousel multi-foto & video reel, spesifikasi fisik (BH, TB, BB, zodiak, bahasa), deskripsi kepribadian, dan jadwal ketersediaan.
4. **Direct Telegram Connect**: Klik tombol "Hubungi via Telegram" langsung membuka aplikasi Telegram talent terkait dengan pesan salam otomatis terformat rapi.
5. **Interaksi Sosial (Like, Rating, Komentar)**: Pengunjung yang masuk dapat memberikan like instan, mengisi bintang rating (1–5 bintang), dan menulis ulasan pengalaman.
6. **Autentikasi & Panel Admin**: Modal Login/Register cepat bagi user, serta opsi beralih ke Mode Admin untuk menambah talent baru, mengubah foto/video, memperbarui status Live, atau menyunting tarif.

### Visual Identity & Theme
- **Aesthetic Direction**: High-end VIP Nightclub & Agency Portfolio. Menggabungkan kemewahan gelap (*obsidian black* `#090A0F`), kilau emas hangat (*champagne gold* `#D4AF37`, `#F59E0B`), dan pendaran lampu malam violet modern (`#8B5CF6`).
- **Color Palette**:
  - Canvas Utama (60%): Deep Obsidian `#07080D` dan Midnight Zinc `#0F1117`.
  - Struktur & Kartu (30%): Hairline border emas transparan `rgba(212, 175, 55, 0.15)` dan permukaan kartu kaca gelap `rgba(18, 20, 29, 0.85)`.
  - Aksen & Aksi (10%): Royal Gold `#D4AF37` untuk tombol primer & rating bintang, serta Electric Telegram Cyan `#229ED9` dan Neon Violet `#A855F7` untuk indikator Live.
- **Typography & Hierarchy**:
  - Display Font: `Plus Jakarta Sans` / `Outfit` dengan tracking tegas untuk judul marquee dan nama talent.
  - Body & Data Font: `DM Sans` dengan kontras tinggi untuk deskripsi, dipadukan `tabular-nums` untuk TB, BB, Size BH, dan angka rating.
  - Zero-Pill Rules: Informasi spesifikasi fisik ditampilkan dengan tipografi bersih tanpa rounded pill capsule tebal yang bertumpuk.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Telegram URL Scheme per Talent**
  - *Chosen Approach*: Setiap talent memiliki properti `telegramUsername` dan nomor direct ID yang membuat URL `https://t.me/{username}?text=Halo%20{namaTalent},%20saya%20tertarik%20booking%20dari%20Katalog`.
  - *Why*: Tidak perlu bot backend yang rumit; pengunjung langsung terhubung secara native ke Telegram talent atau CS resmi tanpa hambatan autentikasi 3rd party.
- **Decision 2: Slider Media Responsif untuk Foto & Video**
  - *Chosen Approach*: Komponen media viewer kustom dengan navigasi swipe/tombol, indikator thumbnail, dukungan video looping MP4 / web preview, serta mode fullscreen lightbox.
  - *Why*: Pengunjung ingin melihat video reel asli dan berbagai angle foto talent sebelum memutuskan untuk menghubungi.
- **Decision 3: Spesifikasi Fisik Terstruktur (Size BH, TB, BB)**
  - *Chosen Approach*: Grid ringkas dan elegan untuk Size BH (contoh: 34B, 36C), Tinggi Badan (cm), dan Berat Badan (kg), yang juga dapat dijadikan filter pencarian di katalog.
  - *Why*: Memenuhi kebutuhan utama klien seperti pada referensi Clubsnight untuk kecocokan preferensi.
- **Decision 4: Sistem Komentar, Like, dan Rating Berbasis Penyimpanan Lokal Cerdas**
  - *Chosen Approach*: State persisten pada browser pengguna (LocalStorage) dengan seed data ulasan yang kaya dan realistis, serta kalkulasi otomatis rating rata-rata bintang dan total like.
  - *Why*: Menjamin fitur ulasan dan bintang berfungsi instan, interaktif, tanpa jeda jaringan atau ketergantungan API eksternal yang lambat.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Navigation & Top Bar                        │
│   [CLUBSNIGHT VIP] ── [Katalog] [Live Talent] [Tentang] ── [Login / Admin]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    │                                                               │
┌───▼──────────────────────┐    ┌──────────────────────────────┐    │
│       Hero Banner        │    │    Filter & Search Bar       │    │
│  - Headline Eksklusif    │    │  - Kota (JKT/SBY/DPS/BDG)    │    │
│  - Marquee Highlights    │    │  - Status Live (Semua/Live)  │    │
│  - Quick Action CTA      │    │  - Sort: Rating / Populer    │    │
└───┬──────────────────────┘    └───┬──────────────────────────┘    │
    │                               │                               │
    └───────────────────────┬───────┘                               │
                            ▼                                       │
┌──────────────────────────────────────────────────────────────┐    │
│                 Talent Catalog Grid (Cards)                  │    │
│  - Foto Utama & Indikator Live Status                        │    │
│  - Nama, Kota, Umur, Size BH, TB (cm), BB (kg)               │    │
│  - Rating Bintang & Jumlah Like                              │    │
│  - Tombol: "Lihat Detail" & "Chat Telegram Langsung"         │    │
└───────────────────────────┬──────────────────────────────────┘    │
                            │ (Klik Kartu)                          │
                            ▼                                       │
┌──────────────────────────────────────────────────────────────┐    │
│               Talent Detail & Media Modal                    │    │
│  - Slider Multi-Media (Foto Slides + Video Player)           │    │
│  - Spesifikasi Lengkap: BH, TB, BB, Zodiak, Bahasa, Tarif    │    │
│  - Direct Telegram Connect dengan Custom Pesan               │    │
│  - Form Ulasan & Bintang Rating (1-5)                        │    │
│  - Daftar Komentar Pengunjung Lain                           │    │
└──────────────────────────────────────────────────────────────┘    │
                                                                    │
┌──────────────────────────────────────────────────────────────┐    │
│                 User Auth & Admin Studio                     │◄───┘
│  - Login / Register Pengunjung (Nama & Nomor/Email)          │
│  - Mode Admin: Tambah Talent, Edit Foto/Video, Update Live   │
└──────────────────────────────────────────────────────────────┘
```

### Data Model & State Schema
```typescript
interface Talent {
  id: string;
  name: string;
  alias: string;
  city: 'Jakarta' | 'Bali' | 'Surabaya' | 'Bandung';
  age: number;
  height: number; // in cm
  weight: number; // in kg
  braSize: string; // e.g. "34B", "36C", "32A", "34C"
  isLive: boolean;
  liveStatusText?: string;
  telegramUsername: string; // e.g. "talent_alexa"
  telegramPhone?: string;
  bio: string;
  services: string[];
  rates: {
    hourly: number;
    vipMeet: number;
  };
  media: {
    type: 'image' | 'video';
    url: string;
    caption?: string;
  }[];
  likesCount: number;
  ratingAverage: number;
  reviewsCount: number;
  verified: boolean;
}

interface Review {
  id: string;
  talentId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}
```

### Verified Assets Strategy
- Menggunakan visual beresolusi tinggi dengan tema nightlife studio portrait eksklusif yang dihasilkan secara terkurasi dan aman untuk platform, dipadukan fallback styling solid dark-gold elegan tanpa broken images.
