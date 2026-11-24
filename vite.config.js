import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: No node polyfills / `buffer` aliases are added on purpose.
// `music-metadata` streams tags through `parseBlob` using browser-native
// Blob/Uint8Array APIs, so the build stays free of Buffer shims.
export default defineConfig({
  base: '/neplaylist/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
})
