import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serve em /void-manual/; Netlify e dev servem na raiz
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
