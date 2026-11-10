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
