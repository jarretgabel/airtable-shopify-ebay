import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function normalizeOrigin(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function sanitizeEbayProxyPath(requestPath: string): string {
  const rewritten = requestPath.replace(/^\/ebay-api-proxy/, '')
  const [pathname, query = ''] = rewritten.split('?')

  if (pathname !== '/sell/inventory/v1/offer' || !query) {
    return rewritten
  }

  const params = new URLSearchParams(query)
  if (!params.has('offset')) {
    return rewritten
  }

  params.delete('offset')
  const nextQuery = params.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const shopifyStoreHost = normalizeOrigin(env.VITE_SHOPIFY_STORE_DOMAIN, 'https://resolution-av-nyc.myshopify.com')
  const shopifyAccessToken = env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN || env.VITE_SHOPIFY_ADMIN_API_TOKEN || ''
  const ebayApiHost = env.VITE_EBAY_ENV?.toLowerCase() === 'production'
    ? 'https://api.ebay.com'
    : 'https://api.sandbox.ebay.com'

  return {
  plugins: [react(), tailwindcss()],
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
        target: shopifyStoreHost,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shopify-proxy/, ''),
        secure: true,
        headers: shopifyAccessToken
          ? {
              'X-Shopify-Access-Token': shopifyAccessToken,
            }
          : undefined,
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
      '/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
        secure: true,
      },
      '/github-models-proxy': {
        target: 'https://models.inference.ai.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-models-proxy/, ''),
        secure: true,
      },
      '/ebay-api-proxy': {
        target: ebayApiHost,
        changeOrigin: true,
        rewrite: sanitizeEbayProxyPath,
        secure: true,
      },
      '/ebay-web-proxy': {
        target: 'https://www.ebay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ebay-web-proxy/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    },
  },
  }
})
