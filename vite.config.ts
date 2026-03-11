import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/shopify-proxy': {
        target: 'https://resolution-av-nyc.myshopify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shopify-proxy/, ''),
        secure: true,
      },
      '/hifishark-proxy': {
        target: 'https://www.hifishark.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hifishark-proxy/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      '/jotform-proxy': {
        target: 'https://api.jotform.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jotform-proxy/, ''),
        secure: true,
      },
    },
  }
})
