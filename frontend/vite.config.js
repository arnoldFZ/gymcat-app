import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

// Injects the CSP as a <meta> in the PRODUCTION build only, so hosts that can't send
// response headers (GitHub Pages) still get a policy. Skipped in dev because Vite/React
// inject an inline script for HMR that `script-src 'self'` would block.
// (frame-ancestors is omitted: it is ignored in <meta>; nginx/_headers set it.)
const CSP = "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.jsdelivr.net; media-src 'self' data: https://cdn.jsdelivr.net; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'"
function cspMeta() {
  return {
    name: 'gymcat-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('</head>', `  <meta http-equiv="Content-Security-Policy" content="${CSP}">\n</head>`)
    }
  }
}

export default defineConfig({
  plugins: [react(), cspMeta()],
  base: './',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  build: { chunkSizeWarningLimit: 1500 }
})
