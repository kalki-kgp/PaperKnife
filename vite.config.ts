import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE || '/'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/logo.svg',
        'logos/icon.png',
        'logos/og-image.png'
      ],
      manifest: {
        name: 'PaperKnife',
        short_name: 'PaperKnife',
        description: 'Private PDF tools that run locally in your browser.',
        theme_color: '#E68A73',
        background_color: '#FFF3F0',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'logos/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logos/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: [
          '**/*.{html,js,mjs,css,ico,png,svg,jpg,jpeg,webp,ttf,woff,woff2,bcmap,wasm,txt,xml}'
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' && url.origin === self.location.origin,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3
            }
          }
        ]
      }
    })
  ],
  base,
  server: {
    host: true
  },
  build: {
    target: 'esnext',
    minify: 'esbuild', // Faster and more stable in resource-constrained environments
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-lib-core': ['pdf-lib'],
          'pdfjs-viewer': ['pdfjs-dist'],
          'tesseract-core': ['tesseract.js'],
          'vendor-ui': ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'sonner'],
          'vendor-utils': ['jszip', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']
        }
      }
    }
  }
})
