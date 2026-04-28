import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  const workspaceRoot = new URL('.', import.meta.url).pathname
  const env = loadEnv(mode, workspaceRoot, 'VITE_')
  const shopifyStoreHost = normalizeOrigin(env.VITE_SHOPIFY_STORE_DOMAIN, 'https://resolution-av-nyc.myshopify.com')
  const shopifyAccessToken = env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN || env.VITE_SHOPIFY_ADMIN_API_TOKEN || ''
  const appApiProxyTarget = env.VITE_APP_API_PROXY_TARGET?.trim()
  const ebayApiHost = env.VITE_EBAY_ENV?.toLowerCase() === 'production'
    ? 'https://api.ebay.com'
    : 'https://api.sandbox.ebay.com'

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
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

          if (id.includes('/src/components/dashboard/') || id.includes('/src/components/DashboardTab.tsx')) return 'feature-dashboard'
          if (id.includes('/src/components/ebay/') || id.includes('/src/components/EbayTab.tsx')) return 'feature-ebay'
          if (id.includes('/src/components/approval/') || id.includes('/src/components/ListingApprovalTab.tsx')) return 'feature-approval'
          if (id.includes('/src/components/users/') || id.includes('/src/components/UserManagementTab.tsx')) return 'feature-users'
          if (id.includes('/src/components/SettingsTab.tsx') || id.includes('/src/components/NotificationsTab.tsx')) return 'feature-account'
          if (id.includes('/src/components/tabs/')) return 'feature-tabs'

          return undefined
        },
      },
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
      ...(appApiProxyTarget
        ? {
            '/api': {
              target: appApiProxyTarget,
              changeOrigin: true,
              secure: /^https:\/\//i.test(appApiProxyTarget),
            },
          }
        : {}),
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
