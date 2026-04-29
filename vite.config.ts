import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const workspaceRoot = new URL('.', import.meta.url).pathname
  const env = loadEnv(mode, workspaceRoot, 'VITE_')
  const appApiProxyTarget = env.VITE_APP_API_PROXY_TARGET?.trim()

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@contracts': new URL('./aws/src/shared/contracts', import.meta.url).pathname,
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
      ...(appApiProxyTarget
        ? {
            '/api': {
              target: appApiProxyTarget,
              changeOrigin: true,
              secure: /^https:\/\//i.test(appApiProxyTarget),
            },
          }
        : {}),
    },
  },
  }
})
