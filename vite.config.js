import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

function pwaServiceWorker() {
  const workerPath = fileURLToPath(new URL('./src/pwa/sw.js', import.meta.url))

  return {
    name: 'pwa-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const precacheAssets = Object.keys(bundle)
        .filter((fileName) => /\.(?:m?js|css)$/i.test(fileName))
        .map((fileName) => `/${fileName}`)
      const source = readFileSync(workerPath, 'utf8').replace(
        '__PRECACHE_ASSETS__',
        JSON.stringify(precacheAssets),
      )

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    pwaServiceWorker(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
