import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { logMissingOptionalEnv } from '@/config/runtimeEnv'
import './index.css'

logMissingOptionalEnv([
  'VITE_GITHUB_TOKEN',
  'VITE_OPENAI_API_KEY',
  'VITE_EBAY_REFRESH_TOKEN',
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
