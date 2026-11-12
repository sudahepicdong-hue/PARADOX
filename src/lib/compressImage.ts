// Kecilkan foto sebelum di-upload: sisi terpanjang maks 1600px, format WebP (atau JPEG kalau browser tidak bisa WebP).
// Foto 2-5 MB biasanya jadi 150-400 KB tanpa terlihat beda di layar. Hemat penyimpanan & kuota bandwidth Supabase,
// dan katalog lebih cepat terbuka di HP. Kalau gagal / hasilnya malah lebih besar, file asli yang dipakai.

const MAX_SIDE = 1600;
const QUALITY = 0.82;
// GIF (bisa bergerak) dan SVG tidak diubah
const SKIP_TYPES = ['image/gif', 'image/svg+xml'];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Foto tidak bisa dibaca'));
    };
    img.src = url;
  });
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || SKIP_TYPES.includes(file.type)) return file;
  try {
    // <img> otomatis memutar foto sesuai orientasi kamera (EXIF), jadi foto HP tidak miring
    const img = await loadImage(file);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) return file;
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    let blob = await toBlob(canvas, 'image/webp');
    // Browser lama (Safari lama) diam-diam mengembalikan PNG kalau tidak bisa WebP
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
