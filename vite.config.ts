import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
  build: {
    outDir: 'dist',
    // File utama (React + Supabase) ±620 KB; library live (LiveKit) ±540 KB dan
    // hanya dimuat saat ruang live dibuka. Peringatan muncul kalau jauh di atas itu.
    chunkSizeWarningLimit: 700,
  },
});
