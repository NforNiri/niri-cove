import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  // Assets live in /static (models, sounds). Must stay 'static' or production builds lose them.
  publicDir: 'static'
});
