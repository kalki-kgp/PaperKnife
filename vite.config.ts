import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const nodeBuiltinShim = path.resolve(rootDir, 'src/shims/node-empty.ts')

const base = process.env.VITE_BASE || '/'
const buildId = Date.now().toString(36)

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId)
  },
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
        launch_handler: {
          client_mode: ['navigate-existing', 'auto']
        },
        file_handlers: [
          {
            action: base,
            accept: {
              'application/pdf': ['.pdf']
            }
          }
        ],
        share_target: {
          action: `${base}share-target`,
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'pdf',
                accept: ['application/pdf', '.pdf']
              }
            ]
          }
        },
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
        importScripts: ['share-target-sw.js'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
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
  resolve: {
    alias: {
      fs: nodeBuiltinShim,
      path: nodeBuiltinShim,
      crypto: nodeBuiltinShim,
    },
  },
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
          'qpdf-wasm': ['@neslinesli93/qpdf-wasm'],
          'tesseract-core': ['tesseract.js'],
          'vendor-ui': ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'sonner'],
          'vendor-utils': ['jszip', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']
        }
      }
    }
  }
})
