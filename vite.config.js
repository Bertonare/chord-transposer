import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['tonal', 'chordsheetjs', 'lamejs', 'tone'],
  },
});
