import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true
  },
  define: {
    'global': 'globalThis'
  },
  build: {
    outDir: 'dist'
  }
});
