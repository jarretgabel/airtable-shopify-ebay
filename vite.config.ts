import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const workspaceRoot = new URL('.', import.meta.url).pathname
  const env = loadEnv(mode, workspaceRoot, '')
  const localApiHost = env.LOCAL_API_HOST?.trim() || '127.0.0.1'
  const localApiPort = env.LOCAL_API_PORT?.trim() || '3001'
  const localApiOrigin = `http://${localApiHost}:${localApiPort}`

    return {
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': new URL('./src', import.meta.url).pathname,
          '@contracts': new URL('./aws/src/shared/contracts', import.meta.url).pathname,
        },
      },
      define: {
        'process.env': {},
        'process': { env: {} },
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('/node_modules/')) {
                if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react'
                if (id.includes('/react-router/') || id.includes('/react-router-dom/')) return 'vendor-router'
                if (id.includes('/zustand/')) return 'vendor-state'
                if (id.includes('/jspdf/')) return 'vendor-jspdf'
                if (id.includes('/html2canvas/')) return 'vendor-html2canvas'
                if (id.includes('/dompurify/')) return 'vendor-dompurify'
                return 'vendor-misc'
              }
              // ...additional manualChunks logic...
            },
          },
        },
      },
      server: {
        port: 3000,
        open: true,
        proxy: {
          '/api': {
            target: localApiOrigin,
            changeOrigin: true,
            secure: false,
          },
        },
      },
    }
  });
