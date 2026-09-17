import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// Absolute origin for Open Graph tags: explicit env, else the Vercel production
// domain injected at build time, else the default project URL.
const SITE_URL = (
  process.env.VITE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'https://niris-cove.vercel.app'
).replace(/\/$/, '');

const siteUrlPlugin = () => ({
  name: 'cove-site-url',
  transformIndexHtml: {
    order: 'pre', // before vite:build-html parses/decodes attribute URLs
    handler: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
  },
});

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    siteUrlPlugin(),
  ],
  // Assets live in /static (models, sounds). Must stay 'static' or production builds lose them.
  publicDir: 'static',
  build: {
    target: 'es2022',
    // Split the stable vendor code from the app so returning visitors keep it cached
    // and the browser fetches the pieces in parallel.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@dimforge/')) return 'rapier';
          if (id.includes('node_modules/')) return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
