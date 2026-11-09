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
    // Library live streaming (LiveKit) ±530 KB, tapi hanya dimuat saat ruang live dibuka
    chunkSizeWarningLimit: 600,
  },
});
