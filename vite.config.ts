import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // `npm run dev` runs the API on 8787; keep the browser on one origin like production.
    proxy: {
      '/api': 'http://localhost:8787',
      '/health': 'http://localhost:8787',
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    // Never inline fonts as data: URLs; the server's CSP only allows same-origin font files.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    rollupOptions: {
      output: {
        // Three.js changes rarely; its own chunk stays cached across game deploys.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
