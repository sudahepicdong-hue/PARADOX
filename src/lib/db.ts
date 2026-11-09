// Semua baca/tulis data website ke Supabase ada di file ini.
import { supabase } from './supabase';
import { Talent, Review, SiteSettings, MediaItem, TalentDocument, Report, ReportReason } from '../types/talent';
import { DEFAULT_SITE_SETTINGS } from '../data/initialTalents';

// ---------------------------------------------------------------------
// Talents
// ---------------------------------------------------------------------
interface TalentRow {
  id: string;
  name: string;
  alias: string;
  city: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  bra_size: string | null;
  is_live: boolean;
  live_status_text: string | null;
  telegram_username: string;
  telegram_phone: string | null;
  bio: string;
  zodiac: string;
  languages: string[];
  services: string[];
  rates: Talent['rates'];
  media: MediaItem[];
  likes_count: number;
  rating_average: number | string;
  reviews_count: number;
  verified: boolean;
  featured: boolean;
  live_stream_title: string | null;
  live_stream_type: Talent['liveStreamType'] | null;
  live_stream_url: string | null;
  live_viewers_count: number | null;
  is_active: boolean;
  id_verified_at: string | null;
  live_heartbeat_at: string | null;
}

export const toTalent = (r: TalentRow): Talent => ({
  id: r.id,
  name: r.name,
  alias: r.alias,
  city: r.city ?? undefined,
  age: r.age ?? undefined,
  height: r.height ?? undefined,
  weight: r.weight ?? undefined,
  braSize: r.bra_size ?? undefined,
  isLive: r.is_live,
  liveStatusText: r.live_status_text ?? undefined,
  telegramUsername: r.telegram_username,
  telegramPhone: r.telegram_phone ?? undefined,
  bio: r.bio,
  zodiac: r.zodiac,
  languages: r.languages ?? [],
  services: r.services ?? [],
  rates: r.rates ?? {},
  media: r.media ?? [],
  likesCount: r.likes_count,
  ratingAverage: Number(r.rating_average),
  reviewsCount: r.reviews_count,
  // Badge "Terverifikasi" = dokumen identitas sudah diperiksa admin
  verified: r.id_verified_at != null,
  featured: r.featured,
  liveStreamTitle: r.live_stream_title ?? undefined,
  liveStreamType: r.live_stream_type ?? undefined,
  liveStreamUrl: r.live_stream_url ?? undefined,
  liveViewersCount: r.live_viewers_count ?? undefined,
  isActive: r.is_active ?? true,
  idVerifiedAt: r.id_verified_at ?? undefined,
  liveHeartbeatAt: r.live_heartbeat_at ?? undefined,
});

// Live dianggap mati kalau browser talent tidak mengirim "detak" selama 90 detik
// (misalnya talent menutup tab tanpa menekan "Akhiri Live").
const LIVE_TIMEOUT_MS = 90_000;
export const isLiveNow = (t: Talent, now = Date.now()) =>
  t.isLive && Boolean(t.liveHeartbeatAt) && now - new Date(t.liveHeartbeatAt!).getTime() < LIVE_TIMEOUT_MS;

// Yang tampil di katalog publik
export const isPubliclyVisible = (t: Talent) => t.isActive !== false && Boolean(t.idVerifiedAt);

// likes_count, rating_average, reviews_count, verified, id_verified_at sengaja tidak dikirim:
// semuanya diatur oleh database / proses verifikasi admin.
const fromTalent = (t: Talent) => ({
  id: t.id,
  name: t.name,
  alias: t.alias,
  city: t.city ?? null,
  age: t.age ?? null,
  height: t.height ?? null,
  weight: t.weight ?? null,
  bra_size: t.braSize ?? null,
  is_live: t.isLive,
  live_status_text: t.liveStatusText ?? null,
  telegram_username: t.telegramUsername,
  telegram_phone: t.telegramPhone ?? null,
  bio: t.bio,
  zodiac: t.zodiac,
  languages: t.languages,
  services: t.services,
  rates: t.rates,
  media: t.media,
  featured: Boolean(t.featured),
  live_stream_title: t.liveStreamTitle ?? null,
  live_stream_type: t.liveStreamType ?? null,
  live_stream_url: t.liveStreamUrl ?? null,
  is_active: t.isActive ?? true,
});

export async function fetchTalents(): Promise<Talent[]> {
  const { data, error } = await supabase
    .from('talents')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data as TalentRow[]).map(toTalent);
}

export async function fetchTalent(id: string): Promise<Talent | null> {
  const { data, error } = await supabase.from('talents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toTalent(data as TalentRow) : null;
}

export async function saveTalent(talent: Talent): Promise<Talent> {
  const { data, error } = await supabase
    .from('talents')
    .upsert(fromTalent(talent))
    .select('*')
    .single();
  if (error) throw error;
  return toTalent(data as TalentRow);
}

// Hapus semua file di satu folder bucket (folder = talent id)
async function removeFolder(bucket: string, folder: string) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  if (error || !data?.length) return;
  await supabase.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
}

// Hapus talent beserta dokumen identitas & foto/video yang diupload ke foldernya.
export async function deleteTalent(id: string): Promise<void> {
  await removeFolder(DOCS_BUCKET, id);
  await removeFolder(MEDIA_BUCKET, id);
  const { data, error } = await supabase.from('talents').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Talent tidak terhapus (tidak punya akses).');
}

// Talent mengubah profilnya sendiri (kolom terlarang otomatis diabaikan database)
export async function updateOwnTalent(talent: Talent): Promise<Talent> {
  const { id, ...fields } = fromTalent(talent);
  const { data, error } = await supabase.from('talents').update(fields).eq('id', id).select('*').single();
  if (error) throw error;
  return toTalent(data as TalentRow);
}

// Real-time: panggil callback setiap ada talent ditambah / diubah / dihapus
export function subscribeTalents(handlers: {
  onUpsert: (talent: Talent) => void;
  onDelete: (id: string) => void;
}): () => void {
  const channel = supabase
    .channel('talents-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'talents' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const oldId = (payload.old as { id?: string })?.id;
        if (oldId) handlers.onDelete(oldId);
      } else {
        handlers.onUpsert(toTalent(payload.new as TalentRow));
      }
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function setTalentLive(
  talentId: string,
  isLive: boolean,
  opts: { title?: string; streamType?: string; streamUrl?: string } = {}
): Promise<void> {
  const { error } = await supabase.rpc('set_talent_live', {
    p_talent_id: talentId,
    p_is_live: isLive,
    p_title: opts.title ?? null,
    p_stream_type: opts.streamType ?? null,
    p_stream_url: opts.streamUrl ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------
interface ReviewRow {
  id: string;
  talent_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const toReview = (r: ReviewRow): Review => ({
  id: r.id,
  talentId: r.talent_id,
  userId: r.user_id,
  userName: r.user_name,
  rating: r.rating,
  comment: r.comment,
  createdAt: dateFormat.format(new Date(r.created_at)),
  isVerifiedClient: false,
});

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, talent_id, user_id, user_name, rating, comment, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ReviewRow[]).map(toReview);
}

// Kalau member sudah pernah mengulas talent ini, ulasan lamanya diganti.
export async function saveReview(userId: string, talentId: string, rating: number, comment: string): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .upsert({ user_id: userId, talent_id: talentId, rating, comment }, { onConflict: 'talent_id,user_id' });
  if (error) throw error;
}

// Hapus ulasan (penulisnya sendiri atau admin)
export async function deleteReview(reviewId: string): Promise<void> {
  const { data, error } = await supabase.from('reviews').delete().eq('id', reviewId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Ulasan tidak terhapus (tidak punya akses).');
}

// ---------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------
export async function fetchMyLikes(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('likes').select('talent_id').eq('user_id', userId);
  if (error) throw error;
  return data.map((r) => r.talent_id as string);
}

export async function setLike(userId: string, talentId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from('likes').upsert({ user_id: userId, talent_id: talentId }, { ignoreDuplicates: true })
    : await supabase.from('likes').delete().eq('user_id', userId).eq('talent_id', talentId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------
export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_SITE_SETTINGS, ...((data?.data as Partial<SiteSettings>) ?? {}) };
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const { data, error } = await supabase.from('site_settings').update({ data: settings }).eq('id', 1).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Pengaturan tidak tersimpan. Pastikan Anda login sebagai admin.');
}

// ---------------------------------------------------------------------
// Upload foto / video ke Supabase Storage
// ---------------------------------------------------------------------
const MEDIA_BUCKET = 'talent-media';
const DOCS_BUCKET = 'talent-documents';
const MAX_UPLOAD_MB = 50;
const MAX_DOC_MB = 10;

const randomFileName = (file: File) => {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
};

// File disimpan di folder <talentId>/ supaya talent hanya bisa mengubah file miliknya sendiri.
export async function uploadMedia(file: File, talentId: string): Promise<string> {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_MB} MB.`);
  }
  const path = `${talentId}/${randomFileName(file)}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw error;

  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------
// Dokumen identitas & verifikasi (khusus admin)
// ---------------------------------------------------------------------
export async function fetchDocuments(talentId: string): Promise<TalentDocument[]> {
  const { data, error } = await supabase
    .from('talent_documents')
    .select('id, talent_id, doc_type, birth_date, storage_path, created_at')
    .eq('talent_id', talentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    talentId: d.talent_id,
    docType: d.doc_type,
    birthDate: d.birth_date,
    storagePath: d.storage_path,
    createdAt: dateFormat.format(new Date(d.created_at)),
  }));
}

export async function uploadDocument(
  talentId: string,
  file: File,
  docType: TalentDocument['docType'],
  birthDate: string
): Promise<void> {
  if (file.size > MAX_DOC_MB * 1024 * 1024) {
    throw new Error(`Ukuran dokumen maksimal ${MAX_DOC_MB} MB.`);
  }
  const path = `${talentId}/${randomFileName(file)}`;
  const { error: upErr } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;

  const { error } = await supabase
    .from('talent_documents')
    .insert({ talent_id: talentId, doc_type: docType, birth_date: birthDate, storage_path: path });
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
    throw error;
  }
}

// Link sementara (5 menit) untuk melihat dokumen privat
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(doc: TalentDocument): Promise<void> {
  await supabase.storage.from(DOCS_BUCKET).remove([doc.storagePath]);
  const { error } = await supabase.from('talent_documents').delete().eq('id', doc.id);
  if (error) throw error;
}

export async function setTalentVerification(talentId: string, verified: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_talent_verification', { p_talent_id: talentId, p_verified: verified });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Login talent (dibuat admin). Setiap talent punya akun dengan email "tersembunyi"
// berbentuk <talent-id>@talent.paradox.invalid; talent cukup pilih nama + password.
// Harus sama dengan TALENT_EMAIL_DOMAIN di supabase/functions/admin-talent-account/index.ts
// ---------------------------------------------------------------------
export const TALENT_EMAIL_DOMAIN = 'talent.paradox.invalid';

export const talentLoginEmail = (talentId: string) =>
  `${talentId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}@${TALENT_EMAIL_DOMAIN}`;

export async function fetchTalentLoginOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc('talent_login_options');
  if (error) throw error;
  return (data as { id: string; name: string }[]) ?? [];
}

// Panggil Edge Function dan ubah error-nya jadi pesan yang bisa dibaca
async function invokeFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;

  const context = (error as { context?: Response }).context;
  let message: string | undefined;
  try {
    message = context ? (await context.clone().json())?.error : undefined;
  } catch {
    /* bukan JSON */
  }
  if (!message && (error.name === 'FunctionsFetchError' || context?.status === 404)) {
    message = `Fungsi "${name}" belum di-deploy ke Supabase. Jalankan: npm run functions:deploy`;
  }
  throw new Error(message || error.message);
}

const callTalentAccountFunction = (body: Record<string, unknown>) =>
  invokeFunction('admin-talent-account', body).then(() => undefined);

// ---------------------------------------------------------------------
// Live streaming (LiveKit)
// ---------------------------------------------------------------------
export const getLiveToken = (talentId: string, role: 'host' | 'viewer') =>
  invokeFunction<{ token: string; url: string }>('livekit-token', { talentId, role });

export async function sendLiveHeartbeat(talentId: string): Promise<void> {
  const { error } = await supabase.rpc('talent_live_heartbeat', { p_talent_id: talentId });
  if (error) throw error;
}

// Moderasi: keluarkan penonton sekarang, atau blokir permanen dari siaran talent ini
export const moderateLive = (talentId: string, action: 'kick' | 'ban', identity: string, name: string) =>
  invokeFunction<{ ok: boolean; note?: string }>('live-moderate', { talentId, action, identity, name });

export interface LiveBan {
  userId: string;
  userName: string;
  createdAt: string;
}

export async function fetchLiveBans(talentId: string): Promise<LiveBan[]> {
  const { data, error } = await supabase
    .from('live_bans')
    .select('user_id, user_name, created_at')
    .eq('talent_id', talentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((b) => ({
    userId: b.user_id,
    userName: b.user_name || 'Member',
    createdAt: dateFormat.format(new Date(b.created_at)),
  }));
}

export async function unbanViewer(talentId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('live_bans').delete().eq('talent_id', talentId).eq('user_id', userId);
  if (error) throw error;
}

// Jumlah penonton tertinggi hari ini (untuk statistik)
export async function recordLiveViewers(talentId: string, viewers: number): Promise<void> {
  await supabase.rpc('record_live_viewers', { p_talent_id: talentId, p_viewers: viewers });
}

// ---------------------------------------------------------------------
// Jadwal live
// ---------------------------------------------------------------------
export interface LiveSchedule {
  id: string;
  talentId: string;
  startsAt: string; // ISO
  note: string;
}

const toSchedule = (r: { id: string; talent_id: string; starts_at: string; note: string }): LiveSchedule => ({
  id: r.id,
  talentId: r.talent_id,
  startsAt: r.starts_at,
  note: r.note,
});

// Jadwal yang akan datang (termasuk yang baru mulai < 2 jam lalu)
export async function fetchUpcomingSchedules(talentId?: string): Promise<LiveSchedule[]> {
  let q = supabase
    .from('live_schedules')
    .select('id, talent_id, starts_at, note')
    .gte('starts_at', new Date(Date.now() - 2 * 3600_000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(100);
  if (talentId) q = q.eq('talent_id', talentId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map(toSchedule);
}

export async function addSchedule(talentId: string, startsAt: Date, note: string): Promise<LiveSchedule> {
  const { data, error } = await supabase
    .from('live_schedules')
    .insert({ talent_id: talentId, starts_at: startsAt.toISOString(), note: note.trim().slice(0, 120) })
    .select('id, talent_id, starts_at, note')
    .single();
  if (error) {
    if (error.code === '42501') throw new Error('Waktu jadwal harus di masa depan (maksimal 60 hari ke depan).');
    throw error;
  }
  return toSchedule(data);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('live_schedules').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------
// Dicatat sekali per talent per sesi browser, supaya refresh tidak menggandakan angka
export function recordTalentView(talentId: string): void {
  const key = `paradox_viewed_${talentId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* penyimpanan diblokir: tetap catat */
  }
  supabase.rpc('record_talent_view', { p_talent_id: talentId }).then(() => {});
}

export interface AdminStats {
  from: string;
  to: string;
  totals: {
    profile_views: number;
    live_sessions: number;
    peak_live_viewers: number;
    new_likes: number;
    new_reviews: number;
    new_members: number;
  };
  daily: { day: string; views: number }[];
  talents: {
    id: string;
    name: string;
    likes: number;
    rating: number;
    reviews: number;
    visible: boolean;
    views: number;
    live_sessions: number;
    peak_viewers: number;
  }[];
}

export async function fetchAdminStats(days: number): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats', { p_days: days });
  if (error) throw error;
  return data as AdminStats;
}

// ---------------------------------------------------------------------
// Akun saya (member)
// ---------------------------------------------------------------------
export async function updateMyName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ name }).eq('id', userId);
  if (error) throw error;
}

// Semua data pribadi milik akun ini, untuk diunduh (hak akses data, UU PDP)
export async function exportMyData(userId: string) {
  const [profile, reviews, likes] = await Promise.all([
    supabase.from('profiles').select('name, email, role, created_at').eq('id', userId).maybeSingle(),
    supabase.from('reviews').select('talent_id, rating, comment, created_at').eq('user_id', userId),
    supabase.from('likes').select('talent_id, created_at').eq('user_id', userId),
  ]);
  for (const r of [profile, reviews, likes]) if (r.error) throw r.error;
  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data,
    reviews: reviews.data,
    likes: likes.data,
  };
}

export const deleteMyAccount = () => invokeFunction('delete-account', {}).then(() => undefined);

// ---------------------------------------------------------------------
// Riwayat aktivitas admin
// ---------------------------------------------------------------------
export interface AuditEntry {
  id: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function fetchAuditLog(limit = 300): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, actor_name, action, target_type, target_id, target_label, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const fmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  return data.map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    targetLabel: r.target_label,
    details: r.details ?? {},
    createdAt: fmt.format(new Date(r.created_at)),
  }));
}

// Buat login baru untuk talent, atau ganti password kalau sudah ada
export const setTalentPassword = (talentId: string, password: string) =>
  callTalentAccountFunction({ action: 'set_password', talentId, password });

// Cabut akses login talent
export const removeTalentLogin = (talentId: string) =>
  callTalentAccountFunction({ action: 'remove_login', talentId });

export async function linkTalentAccount(email: string, talentId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_link_talent_account', { p_email: email, p_talent_id: talentId });
  if (error) throw error;
}

export async function fetchTalentAccountEmail(talentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_talent_account_email', { p_talent_id: talentId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ---------------------------------------------------------------------
// Laporan (report)
// ---------------------------------------------------------------------
export const REPORT_REASONS: Record<ReportReason, string> = {
  underage: 'Dugaan di bawah umur (di bawah 18 tahun)',
  coercion: 'Dugaan paksaan / perdagangan orang',
  fake: 'Profil palsu / penipuan',
  inappropriate: 'Konten tidak pantas',
  spam: 'Spam',
  other: 'Lainnya',
};

export const URGENT_REASONS: ReportReason[] = ['underage', 'coercion'];

export async function createReport(input: {
  targetType: 'talent' | 'review';
  talentId: string;
  reviewId?: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    target_type: input.targetType,
    talent_id: input.talentId,
    review_id: input.reviewId ?? null,
    reason: input.reason,
    details: input.details,
  });
  if (error) throw error;
}

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, target_type, talent_id, review_id, reason, details, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    targetType: r.target_type,
    talentId: r.talent_id ?? undefined,
    reviewId: r.review_id ?? undefined,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: dateFormat.format(new Date(r.created_at)),
  }));
}

export async function setReportStatus(reportId: string, status: Report['status']): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({ status, resolved_at: status === 'open' ? null : new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw error;
}

// Admin menyembunyikan / menampilkan talent (misalnya saat ada laporan)
export async function setTalentActive(talentId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('talents').update({ is_active: isActive }).eq('id', talentId);
  if (error) throw error;
}
