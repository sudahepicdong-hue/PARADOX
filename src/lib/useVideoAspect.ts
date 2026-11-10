import { CSSProperties, RefObject, useEffect, useState } from 'react';

// Ikuti bentuk asli video (tegak / mendatar), supaya kotaknya pas dan wajah tidak terpotong.
export function useVideoAspect(videoRef: RefObject<HTMLVideoElement | null>, fallback = 16 / 9) {
  const [ratio, setRatio] = useState(fallback);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const update = () => {
      if (el.videoWidth && el.videoHeight) setRatio(el.videoWidth / el.videoHeight);
    };
    el.addEventListener('loadedmetadata', update);
    el.addEventListener('resize', update); // berubah saat HP diputar
    update();
    return () => {
      el.removeEventListener('loadedmetadata', update);
      el.removeEventListener('resize', update);
    };
  }, [videoRef]);
  return ratio;
}

// Ukuran kotak video: lebar penuh, tapi tidak lebih tinggi dari 70% layar
export const videoBoxStyle = (ratio: number): CSSProperties => ({
  aspectRatio: String(ratio),
  width: `min(100%, calc(70dvh * ${ratio}))`
});

// HP sedang dipegang tegak?
export const isPortraitPhone = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(orientation: portrait)').matches &&
  window.matchMedia('(pointer: coarse)').matches;

// Buka kamera depan + mikrofon. Di HP tegak, coba beberapa pengaturan sampai gambarnya benar-benar tegak,
// karena tiap HP/browser (Samsung, iPhone, browser bawaan Telegram) menanggapi permintaan ukuran berbeda-beda.
export async function openCameraAndMic(): Promise<{ audio: MediaStreamTrack; video: MediaStreamTrack }> {
  const md = navigator.mediaDevices;
  const portrait = isPortraitPhone();
  const tries: MediaTrackConstraints[] = portrait
    ? [
        { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, // sebagian Android membalik ukurannya
        { facingMode: 'user' },
        { facingMode: 'user', aspectRatio: { exact: 9 / 16 }, height: { ideal: 1280 } } // terakhir: potong jadi tegak
      ]
    : [{ facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }];

  const isTall = (t: MediaStreamTrack) => {
    const { width, height } = t.getSettings();
    return !width || !height || height > width;
  };

  // Percobaan pertama sekalian minta izin mikrofon
  const first = await md.getUserMedia({ audio: true, video: tries[0] });
  const audio = first.getAudioTracks()[0];
  let video = first.getVideoTracks()[0];
  if (!portrait || isTall(video)) return { audio, video };

  for (const c of tries.slice(1)) {
    video.stop();
    try {
      video = (await md.getUserMedia({ video: c })).getVideoTracks()[0];
      if (isTall(video)) return { audio, video };
    } catch {
      // pengaturan ini tidak didukung, lanjut ke berikutnya
      video = (await md.getUserMedia({ video: { facingMode: 'user' } })).getVideoTracks()[0];
    }
  }
  return { audio, video };
}
