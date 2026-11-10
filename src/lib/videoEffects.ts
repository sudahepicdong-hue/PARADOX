// Filter warna & topeng wajah untuk kamera live.
// Cara kerja: gambar kamera asli dilukis ulang ke kanvas setiap frame (+ filter / topeng),
// lalu kanvas itulah yang dikirim ke penonton. Topeng mengikuti wajah lewat MediaPipe Face Landmarker.
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type ColorFilter = 'none' | 'cerah' | 'hangat' | 'dingin' | 'pink' | 'vintage' | 'bw';
export type FaceMask = 'none' | 'topeng' | 'kacamata' | 'kucing' | 'masker' | 'sensor';
export type MaskStatus = 'idle' | 'loading' | 'ready' | 'error';

export const COLOR_FILTERS: { id: ColorFilter; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'cerah', label: 'Cerah' },
  { id: 'hangat', label: 'Hangat' },
  { id: 'dingin', label: 'Dingin' },
  { id: 'pink', label: 'Pink' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'bw', label: 'Hitam Putih' }
];

export const FACE_MASKS: { id: FaceMask; label: string; emoji: string }[] = [
  { id: 'none', label: 'Tanpa', emoji: '🙂' },
  { id: 'topeng', label: 'Topeng Pesta', emoji: '🎭' },
  { id: 'kacamata', label: 'Kacamata', emoji: '🕶️' },
  { id: 'kucing', label: 'Kucing', emoji: '🐱' },
  { id: 'masker', label: 'Masker', emoji: '😷' },
  { id: 'sensor', label: 'Sensor Wajah', emoji: '🟪' }
];

// Lapisan warna di atas gambar (pakai mode campur kanvas, jalan di Android & iPhone)
const FILTER_LAYERS: Record<ColorFilter, [GlobalCompositeOperation, string][]> = {
  none: [],
  cerah: [['screen', 'rgba(255,255,255,0.12)'], ['soft-light', 'rgba(255,190,170,0.3)']],
  hangat: [['soft-light', 'rgba(255,140,40,0.45)']],
  dingin: [['soft-light', 'rgba(40,120,255,0.45)']],
  pink: [['soft-light', 'rgba(255,90,160,0.4)']],
  vintage: [['saturation', 'rgba(128,128,128,0.55)'], ['multiply', 'rgba(255,225,180,0.35)']],
  bw: [['saturation', '#808080']]
};

const MP_VERSION = '1.1.1';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;
function loadLandmarker() {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`);
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1
      });
    try {
      return await make('GPU');
    } catch {
      return await make('CPU'); // HP tanpa dukungan GPU
    }
  })();
  landmarkerPromise.catch(() => (landmarkerPromise = null)); // boleh dicoba lagi
  return landmarkerPromise;
}

type Pt = { x: number; y: number };
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

// Garis rahang dari pipi kiri, lewat dagu, ke pipi kanan (titik MediaPipe)
const JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
const MAX_MISSING_FRAMES = 15; // wajah hilang sebentar: topeng tetap di posisi terakhir

export class VideoEffects {
  readonly track: MediaStreamTrack;
  filter: ColorFilter = 'none';
  private mask: FaceMask = 'none';
  onMaskStatus?: (s: MaskStatus) => void;

  private video: HTMLVideoElement;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private pixel = document.createElement('canvas');
  private landmarker: FaceLandmarker | null = null;
  private landmarks: NormalizedLandmark[] | null = null;
  private missing = 0;
  private lastDetect = 0;
  private raf = 0;
  private stopped = false;

  constructor(private source: MediaStreamTrack) {
    this.ctx = this.canvas.getContext('2d')!;
    const s = source.getSettings();
    this.canvas.width = s.width || 720;
    this.canvas.height = s.height || 1280;

    // Video sumber disembunyikan (iPhone hanya memutar video yang ada di halaman)
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    this.video.srcObject = new MediaStream([source]);
    document.body.appendChild(this.video);
    this.video.play().catch(() => {});

    this.track = this.canvas.captureStream(30).getVideoTracks()[0];
    this.loop();
  }

  setMask(mask: FaceMask) {
    this.mask = mask;
    if (mask === 'none' || this.landmarker) return;
    this.setStatus('loading');
    loadLandmarker()
      .then((l) => {
        this.landmarker = l;
        this.setStatus('ready');
      })
      .catch(() => this.setStatus('error'));
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.track.stop();
    this.source.stop();
    this.video.srcObject = null;
    this.video.remove();
  }

  private setStatus(s: MaskStatus) {
    this.onMaskStatus?.(s);
  }

  private loop = () => {
    if (this.stopped) return;
    try {
      this.drawFrame();
    } catch {
      // satu frame gagal tidak boleh menghentikan siaran
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawFrame() {
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return;
    const { canvas, ctx } = this;
    if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
      canvas.width = v.videoWidth; // HP diputar
      canvas.height = v.videoHeight;
    }
    const w = canvas.width, h = canvas.height;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(v, 0, 0, w, h);

    for (const [op, color] of FILTER_LAYERS[this.filter]) {
      ctx.globalCompositeOperation = op;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';

    if (this.mask === 'none') return;
    this.detect(v);

    if (!this.landmarks) {
      // Sensor wajah: kalau wajah belum/tidak terdeteksi, samarkan seluruh gambar supaya wajah tidak bocor
      if (this.mask === 'sensor') this.pixelate(0, 0, w, h, 40);
      return;
    }
    const p = (i: number): Pt => ({ x: this.landmarks![i].x * w, y: this.landmarks![i].y * h });
    switch (this.mask) {
      case 'topeng': return this.drawMasquerade(p);
      case 'kacamata': return this.drawSunglasses(p);
      case 'kucing': return this.drawCat(p);
      case 'masker': return this.drawMedicalMask(p);
      case 'sensor': return this.drawSensor(w, h);
    }
  }

  private detect(v: HTMLVideoElement) {
    if (!this.landmarker) return;
    const now = performance.now();
    if (now - this.lastDetect < 33) return; // maks ±30x per detik
    this.lastDetect = now;
    const found = this.landmarker.detectForVideo(v, now).faceLandmarks?.[0];
    if (found) {
      const prev = this.landmarks;
      // Haluskan gerakan supaya topeng tidak bergetar
      this.landmarks =
        prev && prev.length === found.length
          ? found.map((l, i) => ({ ...l, x: prev[i].x * 0.4 + l.x * 0.6, y: prev[i].y * 0.4 + l.y * 0.6 }))
          : found;
      this.missing = 0;
    } else if (++this.missing > MAX_MISSING_FRAMES) {
      this.landmarks = null;
    }
  }

  // Bidang wajah: titik tengah antar-mata, kemiringan kepala, dan lebar mata sebagai ukuran
  private eyeFrame(p: (i: number) => Pt) {
    const l = p(33), r = p(263);
    return { c: mid(l, r), ang: Math.atan2(r.y - l.y, r.x - l.x), d: dist(l, r) };
  }

  private withFrame(origin: Pt, ang: number, scale: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    draw(ctx);
    ctx.restore();
  }

  private drawMasquerade(p: (i: number) => Pt) {
    const { c, ang, d } = this.eyeFrame(p);
    this.withFrame(c, ang, d, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-0.8, -0.05);
      ctx.bezierCurveTo(-0.78, -0.45, -0.28, -0.42, 0, -0.15);
      ctx.bezierCurveTo(0.28, -0.42, 0.78, -0.45, 0.8, -0.05);
      ctx.bezierCurveTo(0.72, 0.3, 0.28, 0.34, 0.09, 0.17);
      ctx.quadraticCurveTo(0, 0.08, -0.09, 0.17);
      ctx.bezierCurveTo(-0.28, 0.34, -0.72, 0.3, -0.8, -0.05);
      ctx.closePath();
      ctx.moveTo(-0.16, 0);
      ctx.ellipse(-0.33, 0, 0.17, 0.11, 0, 0, Math.PI * 2);
      ctx.moveTo(0.5, 0);
      ctx.ellipse(0.33, 0, 0.17, 0.11, 0, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(-0.8, -0.4, 0.8, 0.3);
      g.addColorStop(0, '#f7d774');
      g.addColorStop(0.35, '#b8860b');
      g.addColorStop(0.6, '#fff1a8');
      g.addColorStop(1, '#8a5a00');
      ctx.fillStyle = g;
      ctx.fill('evenodd');
      ctx.lineWidth = 0.025;
      ctx.strokeStyle = '#5c3a00';
      ctx.stroke();
      // Hiasan permata di tengah
      ctx.beginPath();
      ctx.arc(0, -0.2, 0.06, 0, Math.PI * 2);
      ctx.fillStyle = '#c2185b';
      ctx.fill();
    });
  }

  private drawSunglasses(p: (i: number) => Pt) {
    const { c, ang, d } = this.eyeFrame(p);
    this.withFrame(c, ang, d, (ctx) => {
      ctx.strokeStyle = '#111';
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.08, -0.04);
      ctx.quadraticCurveTo(0, -0.1, 0.08, -0.04); // jembatan
      ctx.moveTo(-0.59, -0.04);
      ctx.lineTo(-0.78, -0.08); // gagang
      ctx.moveTo(0.59, -0.04);
      ctx.lineTo(0.78, -0.08);
      ctx.stroke();
      for (const x of [-0.33, 0.33]) {
        ctx.beginPath();
        ctx.ellipse(x, 0.01, 0.28, 0.22, 0, 0, Math.PI * 2);
        const g = ctx.createLinearGradient(x - 0.2, -0.2, x + 0.2, 0.25);
        g.addColorStop(0, '#3a3a3a');
        g.addColorStop(1, '#050505');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 0.04;
        ctx.stroke();
        // kilau lensa
        ctx.beginPath();
        ctx.ellipse(x - 0.09, -0.06, 0.07, 0.035, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
    });
  }

  private drawCat(p: (i: number) => Pt) {
    const { ang, d } = this.eyeFrame(p);
    // Telinga di atas dahi
    this.withFrame(p(10), ang, d, (ctx) => {
      ctx.translate(0, -0.3); // naik ke atas dahi, di rambut
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 0.85, 0.05);
        ctx.lineTo(s * 0.7, -0.85);
        ctx.lineTo(s * 0.18, -0.2);
        ctx.closePath();
        ctx.fillStyle = '#2b1d16';
        ctx.fill();
        ctx.lineWidth = 0.03;
        ctx.strokeStyle = '#f7a1b5';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.7, -0.05);
        ctx.lineTo(s * 0.63, -0.62);
        ctx.lineTo(s * 0.32, -0.22);
        ctx.closePath();
        ctx.fillStyle = '#f7a1b5';
        ctx.fill();
      }
    });
    // Hidung & kumis
    this.withFrame(p(1), ang, d, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-0.08, -0.03);
      ctx.lineTo(0.08, -0.03);
      ctx.lineTo(0, 0.06);
      ctx.closePath();
      ctx.fillStyle = '#e75480';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,30,30,0.85)';
      ctx.lineWidth = 0.018;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const s of [-1, 1]) {
        for (const k of [-1, 0, 1]) {
          ctx.moveTo(s * 0.14, 0.1 + k * 0.04);
          ctx.lineTo(s * 0.65, 0.04 + k * 0.12);
        }
      }
      ctx.stroke();
    });
  }

  private drawMedicalMask(p: (i: number) => Pt) {
    const ctx = this.ctx;
    const nose = p(195), left = p(234), right = p(454);
    const up = { x: 0, y: -dist(left, right) * 0.06 };
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    for (const i of JAW) ctx.lineTo(p(i).x, p(i).y);
    const m1 = mid(right, nose), m2 = mid(nose, left);
    ctx.quadraticCurveTo(m1.x + up.x, m1.y + up.y, nose.x, nose.y);
    ctx.quadraticCurveTo(m2.x + up.x, m2.y + up.y, left.x, left.y);
    ctx.closePath();
    const g = ctx.createLinearGradient(nose.x, nose.y, p(152).x, p(152).y);
    g.addColorStop(0, '#d9f0fb');
    g.addColorStop(1, '#9fd3ee');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, dist(left, right) * 0.012);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    // Lipatan masker
    ctx.strokeStyle = 'rgba(40,90,120,0.25)';
    ctx.beginPath();
    for (const [a, b] of [[93, 323], [132, 361], [58, 288]]) {
      ctx.moveTo(p(a).x, p(a).y);
      ctx.lineTo(p(b).x, p(b).y);
    }
    // Tali ke telinga
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(p(127).x, p(127).y);
    ctx.moveTo(right.x, right.y);
    ctx.lineTo(p(356).x, p(356).y);
    ctx.stroke();
    ctx.restore();
  }

  private drawSensor(w: number, h: number) {
    let x1 = 1, y1 = 1, x2 = 0, y2 = 0;
    for (const l of this.landmarks!) {
      x1 = Math.min(x1, l.x); y1 = Math.min(y1, l.y);
      x2 = Math.max(x2, l.x); y2 = Math.max(y2, l.y);
    }
    const padX = (x2 - x1) * 0.25, padY = (y2 - y1) * 0.25;
    const x = Math.max(0, (x1 - padX) * w), y = Math.max(0, (y1 - padY * 1.4) * h);
    this.pixelate(x, y, Math.min(w, (x2 + padX) * w) - x, Math.min(h, (y2 + padY) * h) - y, 12);
  }

  // Kotak-kotak (mosaik) pada area tertentu
  private pixelate(x: number, y: number, bw: number, bh: number, blocks: number) {
    if (bw < 2 || bh < 2) return;
    const tw = Math.max(2, Math.round(blocks)), th = Math.max(2, Math.round((blocks * bh) / bw));
    this.pixel.width = tw;
    this.pixel.height = th;
    const pctx = this.pixel.getContext('2d')!;
    pctx.drawImage(this.canvas, x, y, bw, bh, 0, 0, tw, th);
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.pixel, 0, 0, tw, th, x, y, bw, bh);
    ctx.restore();
  }
}
