// Filter warna & topeng wajah untuk kamera live.
// Cara kerja: gambar kamera asli dilukis ulang ke kanvas setiap frame (+ filter / topeng),
// lalu kanvas itulah yang dikirim ke penonton. Topeng mengikuti wajah lewat MediaPipe Face Landmarker.
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { BeautyGL, Vec2 } from './beautyGL';

export type ColorFilter = 'none' | 'cerah' | 'hangat' | 'dingin' | 'pink' | 'vintage' | 'bw';
export type FaceMask =
  | 'none' | 'topeng' | 'kacamata' | 'kucing' | 'kelinci' | 'anjing' | 'mahkota' | 'bunga' | 'love' | 'masker' | 'sensor';
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
  { id: 'love', label: 'Love', emoji: '💕' },
  { id: 'kucing', label: 'Kucing', emoji: '🐱' },
  { id: 'kelinci', label: 'Kelinci', emoji: '🐰' },
  { id: 'anjing', label: 'Anjing', emoji: '🐶' },
  { id: 'mahkota', label: 'Mahkota', emoji: '👑' },
  { id: 'bunga', label: 'Mahkota Bunga', emoji: '🌸' },
  { id: 'masker', label: 'Masker', emoji: '😷' },
  { id: 'sensor', label: 'Sensor Wajah', emoji: '🟪' }
];

// Percantik: semua nilai 0 (mati) sampai 1 (maksimal)
export interface BeautySettings {
  smooth: number; // haluskan kulit
  bright: number; // cerahkan
  slim: number; // tiruskan wajah
  eyes: number; // besarkan mata
  lips: number; // warna bibir
  blush: number; // rona pipi
}
export const BEAUTY_SLIDERS: { key: keyof BeautySettings; label: string }[] = [
  { key: 'smooth', label: 'Haluskan Kulit' },
  { key: 'bright', label: 'Cerahkan' },
  { key: 'slim', label: 'Tiruskan Wajah' },
  { key: 'eyes', label: 'Besarkan Mata' },
  { key: 'lips', label: 'Warna Bibir' },
  { key: 'blush', label: 'Rona Pipi' }
];
export const BEAUTY_PRESETS: { id: string; label: string; value: BeautySettings }[] = [
  { id: 'off', label: 'Mati', value: { smooth: 0, bright: 0, slim: 0, eyes: 0, lips: 0, blush: 0 } },
  { id: 'natural', label: 'Natural', value: { smooth: 0.45, bright: 0.25, slim: 0.2, eyes: 0.1, lips: 0.2, blush: 0.15 } },
  { id: 'glowing', label: 'Glowing', value: { smooth: 0.65, bright: 0.5, slim: 0.35, eyes: 0.25, lips: 0.35, blush: 0.3 } },
  { id: 'max', label: 'Maksimal', value: { smooth: 0.9, bright: 0.7, slim: 0.6, eyes: 0.45, lips: 0.5, blush: 0.45 } }
];
const beautyOn = (b: BeautySettings) => Object.values(b).some((v) => v > 0);
// Hanya "cerahkan" yang bisa jalan tanpa posisi wajah; sisanya perlu pendeteksi wajah
const beautyNeedsFace = (b: BeautySettings) => b.smooth > 0 || b.slim > 0 || b.eyes > 0 || b.lips > 0 || b.blush > 0;

// Bibir: garis luar & dalam (bagian dalam mulut tidak diwarnai)
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

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
  private beauty: BeautySettings = { ...BEAUTY_PRESETS[0].value };
  private gl: BeautyGL | null | undefined; // undefined = belum dicoba
  onMaskStatus?: (s: MaskStatus) => void;

  private video: HTMLVideoElement;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private pixel = document.createElement('canvas');
  private landmarker: FaceLandmarker | null = null;
  private landmarks: NormalizedLandmark[] | null = null;
  private missing = 0;
  private loadingFace = false;
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
    if (mask !== 'none') this.ensureLandmarker();
  }

  setBeauty(b: BeautySettings) {
    this.beauty = { ...b };
    if (beautyNeedsFace(b)) this.ensureLandmarker();
  }

  // Muat pendeteksi wajah sekali saja (dipakai topeng & percantik)
  private ensureLandmarker() {
    if (this.landmarker || this.loadingFace) return;
    this.loadingFace = true;
    this.setStatus('loading');
    loadLandmarker()
      .then((l) => {
        this.landmarker = l;
        this.setStatus('ready');
      })
      .catch(() => this.setStatus('error'))
      .finally(() => (this.loadingFace = false));
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

    const needFace = this.mask !== 'none' || beautyNeedsFace(this.beauty);
    if (needFace) this.detect(v);
    const p = (i: number): Pt => ({ x: this.landmarks![i].x * w, y: this.landmarks![i].y * h });

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const beautified = beautyOn(this.beauty) && this.drawBeauty(v, w, h);
    if (!beautified) ctx.drawImage(v, 0, 0, w, h);
    if (this.landmarks && beautyOn(this.beauty)) this.drawMakeup(p);

    for (const [op, color] of FILTER_LAYERS[this.filter]) {
      ctx.globalCompositeOperation = op;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';

    if (this.mask === 'none') return;

    if (!this.landmarks) {
      // Sensor wajah: kalau wajah belum/tidak terdeteksi, samarkan seluruh gambar supaya wajah tidak bocor
      if (this.mask === 'sensor') this.pixelate(0, 0, w, h, 40);
      return;
    }
    switch (this.mask) {
      case 'topeng': return this.drawMasquerade(p);
      case 'kacamata': return this.drawSunglasses(p);
      case 'kucing': return this.drawCat(p);
      case 'kelinci': return this.drawBunny(p);
      case 'anjing': return this.drawDog(p);
      case 'mahkota': return this.drawCrown(p);
      case 'bunga': return this.drawFlowerCrown(p);
      case 'love': return this.drawLove(p);
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

  // Haluskan / cerahkan / tiruskan / besarkan mata lewat WebGL. false = tidak bisa (pakai gambar biasa).
  private drawBeauty(v: HTMLVideoElement, w: number, h: number): boolean {
    if (this.gl === undefined) this.gl = BeautyGL.create();
    if (!this.gl) return false;
    const b = this.beauty;
    const lm = this.landmarks;
    const zero: Vec2 = [0, 0];
    if (lm) {
      const P = (i: number): Vec2 => [lm[i].x * w, lm[i].y * h];
      const avg = (ids: number[]): Vec2 => {
        const pts = ids.map(P);
        return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
      };
      const d = (a: Vec2, c: Vec2) => Math.hypot(a[0] - c[0], a[1] - c[1]);
      const faceW = d(P(234), P(454));
      const faceH = d(P(10), P(152));
      const l = P(33), r = P(263), nose = P(1);
      const from = [P(132), P(172), P(361), P(397)];
      this.gl.render(v, w, h, {
        hasFace: true,
        eyeL: avg([33, 133, 159, 145]),
        eyeR: avg([263, 362, 386, 374]),
        eyeRad: d(P(33), P(133)) * 1.05,
        eye: b.eyes * 0.22,
        slimFrom: from,
        slimTo: from.map((c): Vec2 => [c[0] + (nose[0] - c[0]) * 0.2 * b.slim, c[1] + (nose[1] - c[1]) * 0.2 * b.slim]),
        slimRad: faceW * 0.45,
        faceC: [(P(10)[0] + P(152)[0]) / 2, (P(10)[1] + P(152)[1]) / 2],
        faceAx: [faceW * 0.5, faceH * 0.55],
        faceAng: Math.atan2(r[1] - l[1], r[0] - l[0]),
        smooth: b.smooth,
        bright: b.bright,
        blurR: Math.max(1.5, faceW * 0.013)
      });
    } else {
      this.gl.render(v, w, h, {
        hasFace: false, eyeL: zero, eyeR: zero, eyeRad: 1, eye: 0,
        slimFrom: [zero, zero, zero, zero], slimTo: [zero, zero, zero, zero], slimRad: 1,
        faceC: zero, faceAx: [1, 1], faceAng: 0,
        smooth: b.smooth, bright: b.bright, blurR: Math.max(1.5, (w / 720) * 3)
      });
    }
    this.ctx.drawImage(this.gl.canvas, 0, 0, w, h);
    return true;
  }

  // Warna bibir & rona pipi
  private drawMakeup(p: (i: number) => Pt) {
    const ctx = this.ctx;
    const b = this.beauty;
    const faceW = dist(p(234), p(454));
    if (b.blush > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      for (const i of [50, 280]) {
        const c = p(i);
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, faceW * 0.17);
        g.addColorStop(0, `rgba(255,60,100,${0.75 * b.blush})`);
        g.addColorStop(1, 'rgba(255,60,100,0)');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - faceW * 0.2, c.y - faceW * 0.2, faceW * 0.4, faceW * 0.4);
      }
      ctx.restore();
    }
    if (b.lips > 0) {
      ctx.save();
      ctx.beginPath();
      LIPS_OUTER.forEach((i, k) => (k ? ctx.lineTo(p(i).x, p(i).y) : ctx.moveTo(p(i).x, p(i).y)));
      ctx.closePath();
      LIPS_INNER.forEach((i, k) => (k ? ctx.lineTo(p(i).x, p(i).y) : ctx.moveTo(p(i).x, p(i).y)));
      ctx.closePath();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(230,20,70,${0.9 * b.lips})`;
      ctx.fill('evenodd');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(255,110,140,${0.35 * b.lips})`;
      ctx.fill('evenodd');
      ctx.restore();
    }
  }

  private drawBunny(p: (i: number) => Pt) {
    const { ang, d } = this.eyeFrame(p);
    this.withFrame(p(10), ang, d, (ctx) => {
      ctx.translate(0, -0.35);
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 0.32, -0.55);
        ctx.rotate(s * 0.18);
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.2, 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fafafa';
        ctx.fill();
        ctx.lineWidth = 0.025;
        ctx.strokeStyle = '#d9d9d9';
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0.05, 0.1, 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f9b3c6';
        ctx.fill();
        ctx.restore();
      }
    });
    this.withFrame(p(1), ang, d, (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, -0.01, 0.09, 0.06, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f48fb1';
      ctx.fill();
    });
  }

  private drawDog(p: (i: number) => Pt) {
    const { ang, d } = this.eyeFrame(p);
    // Telinga panjang di sisi kepala
    this.withFrame(p(10), ang, d, (ctx) => {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 1.0, 0.0);
        ctx.rotate(s * -0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0.25, 0.24, 0.55, 0, 0, Math.PI * 2);
        const g = ctx.createLinearGradient(0, -0.3, 0, 0.8);
        g.addColorStop(0, '#8d5a2b');
        g.addColorStop(1, '#5d3a1a');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
    });
    // Hidung hitam mengkilap
    this.withFrame(p(1), ang, d, (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, -0.02, 0.17, 0.11, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1b1b';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-0.05, -0.06, 0.05, 0.025, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    });
    // Lidah keluar kalau mulut terbuka
    const open = dist(p(13), p(14)) / dist(p(10), p(152));
    if (open > 0.045) {
      this.withFrame(p(14), ang, d, (ctx) => {
        const len = Math.min(0.75, 0.25 + open * 4);
        ctx.beginPath();
        ctx.moveTo(-0.17, -0.05);
        ctx.lineTo(-0.17, len - 0.15);
        ctx.quadraticCurveTo(-0.17, len, 0, len);
        ctx.quadraticCurveTo(0.17, len, 0.17, len - 0.15);
        ctx.lineTo(0.17, -0.05);
        ctx.closePath();
        ctx.fillStyle = '#ff6f91';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, len * 0.7);
        ctx.lineWidth = 0.02;
        ctx.strokeStyle = '#d94c70';
        ctx.stroke();
      });
    }
  }

  private drawCrown(p: (i: number) => Pt) {
    const { ang, d } = this.eyeFrame(p);
    this.withFrame(p(10), ang, d, (ctx) => {
      ctx.translate(0, -0.3);
      ctx.beginPath();
      ctx.moveTo(-0.7, 0);
      ctx.lineTo(-0.78, -0.55);
      ctx.lineTo(-0.4, -0.28);
      ctx.lineTo(0, -0.72);
      ctx.lineTo(0.4, -0.28);
      ctx.lineTo(0.78, -0.55);
      ctx.lineTo(0.7, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -0.7, 0, 0);
      g.addColorStop(0, '#fff3a6');
      g.addColorStop(0.5, '#f5c542');
      g.addColorStop(1, '#b8860b');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 0.03;
      ctx.strokeStyle = '#7a5600';
      ctx.stroke();
      const gems: [number, number, string][] = [[-0.78, -0.58, '#e53935'], [0, -0.76, '#1e88e5'], [0.78, -0.58, '#e53935'], [0, -0.14, '#43a047']];
      for (const [x, y, c] of gems) {
        ctx.beginPath();
        ctx.arc(x, y, 0.07, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
        ctx.lineWidth = 0.02;
        ctx.stroke();
      }
    });
  }

  private drawFlowerCrown(p: (i: number) => Pt) {
    const { ang, d } = this.eyeFrame(p);
    const colors = ['#f48fb1', '#ffffff', '#ce93d8', '#ffcc80'];
    this.withFrame(p(10), ang, d, (ctx) => {
      ctx.translate(0, -0.12);
      const n = 9;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const x = -0.9 + t * 1.8;
        const y = -0.38 * Math.sin(Math.PI * t) + 0.08;
        const r = k % 2 ? 0.1 : 0.13;
        // daun
        ctx.beginPath();
        ctx.ellipse(x + 0.1, y + 0.06, 0.09, 0.04, 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#66bb6a';
        ctx.fill();
        // kelopak
        ctx.fillStyle = colors[k % colors.length];
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#fdd835';
        ctx.fill();
      }
    });
  }

  // Hati berputar di sekitar kepala + pipi merona
  private drawLove(p: (i: number) => Pt) {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    const faceW = dist(p(234), p(454));
    const faceH = dist(p(10), p(152));
    const c = mid(p(10), p(152));
    for (let k = 0; k < 7; k++) {
      const a = t * 1.2 + (k / 7) * Math.PI * 2;
      const x = c.x + Math.cos(a) * faceW * 0.85;
      const y = c.y - faceH * 0.15 + Math.sin(a) * faceH * 0.75;
      const size = faceW * (0.13 + 0.04 * Math.sin(t * 3 + k));
      heart(ctx, x, y - size / 2, size, k % 2 ? '#ff4d8d' : '#ff1744');
    }
    const { ang, d } = this.eyeFrame(p);
    for (const i of [50, 280]) {
      this.withFrame(p(i), ang, d, (g) => {
        g.beginPath();
        g.ellipse(0, 0, 0.17, 0.09, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,82,120,0.45)';
        g.fill();
      });
    }
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

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fillStyle = color;
  ctx.fill();
}
