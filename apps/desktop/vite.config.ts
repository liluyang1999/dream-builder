import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { sceneVendorChunk } from './viteChunks';

export default defineConfig({
  plugins: [react()],
  // Vite serves source close to `esnext` in development by default. Chromium
  // does not yet parse standard decorator syntax, so match our TypeScript
  // target and downlevel decorators in both dev and production transforms.
  esbuild: { target: 'es2022' },
  clearScreen: false,
  server: { strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // R3F's Canvas registers the complete Three namespace. Keep that stable
    // engine isolated and enforce its 700 kB ceiling after every build.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: sceneVendorChunk,
        // Do not pull shared React dependencies into a deferred scene chunk.
        onlyExplicitManualChunks: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
