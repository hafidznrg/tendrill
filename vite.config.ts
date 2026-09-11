/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * Peta chunk mengikat dok. 06 §6. Nama chunk dipakai langsung oleh
 * scripts/check-bundle-budget.ts — mengganti nama di sini berarti
 * mengganti dok. 06 dan gerbang anggarannya juga.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // Sumber peta dimatikan di prod: anggaran bundel diukur dari .js saja.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Dependensi runtime dipisah supaya anggaran framework vs kode
          // aplikasi bisa DIUKUR, bukan diperkirakan (ADR-018). Efek samping
          // yang menguntungkan: perubahan kode kita tidak lagi membatalkan
          // cache framework di browser pengguna.
          if (id.includes('/node_modules/')) return 'vendor';
          if (id.includes('/src/data/curriculum/')) {
            const m = /\/lessons\/unit-(\d)\./.exec(id);
            if (m) return `unit-${m[1]}`;
            return 'curriculum-map';
          }
          if (id.includes('/src/data/wordlists/') || id.includes('/src/data/quotes/')) {
            return 'wordlists';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
