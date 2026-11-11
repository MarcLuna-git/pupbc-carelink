import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Same-origin API by default; an absolute VITE_API_URL (Render) adds its origin.
const apiOrigin = (apiUrl) => {
  try {
    const origin = new URL(apiUrl).origin
    return origin === 'null' ? '' : origin
  } catch {
    return ''
  }
}

// Production Content-Security-Policy. No inline scripts or styles at all: the
// app, the print templates (print.css, qr-card.css) and the hero preload are
// all files. React style props are set through the DOM, which CSP allows.
// data:/blob: images are the QR code, kiosk photo and exported files; the API
// origin serves avatars. Keep render.yaml's copy of this policy in sync.
const contentSecurityPolicy = (apiUrl) => {
  const api = apiOrigin(apiUrl)
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    ['img-src', "'self'", 'data:', 'blob:', api].filter(Boolean).join(' '),
    "font-src 'self' data:",
    ['connect-src', "'self'", api].filter(Boolean).join(' '),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

// Headers for the local dev and preview servers. HSTS is left out on purpose:
// on localhost it would force every http://localhost site to HTTPS.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
}

// Production-only <head> additions: resource hints (if an asset or the API
// origin cannot be resolved, the hint is simply left out) and the
// Content-Security-Policy <meta>.
const resourceHints = (apiUrl) => {
  let base = '/'
  let heroPreload = null
  return {
    name: 'carelink-resource-hints',
    apply: 'build',
    configResolved(config) { base = config.base },
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        const tags = []

        // The API usually lives on another origin (Render/Z.com); open the
        // connection while the scripts are still downloading.
        try {
          const origin = new URL(apiUrl).origin
          if (origin !== 'null') {
            tags.push({
              tag: 'link',
              attrs: { rel: 'preconnect', href: origin, crossorigin: '' },
              injectTo: 'head-prepend',
            })
          }
        } catch { /* relative or unset VITE_API_URL: same origin, nothing to do */ }

        // The landing hero is the LCP image but only appears after React
        // renders; start fetching it with the page. Landing only ('/').
        // A small file, not an inline <script>, so the CSP needs no exception;
        // writeBundle below writes it next to the other assets.
        const hero = Object.keys(bundle || {}).find((file) => /(^|\/)pup-binan-hero-[\w-]+\.jpg$/.test(file))
        heroPreload = null
        if (hero) {
          const code = `if(location.pathname==='/'){var l=document.createElement('link');l.rel='preload';l.as='image';l.href='${base}${hero}';l.setAttribute('fetchpriority','high');document.head.appendChild(l)}\n`
          const fileName = `assets/hero-preload-${createHash('sha256').update(code).digest('hex').slice(0, 8)}.js`
          heroPreload = { fileName, code }
          tags.push({ tag: 'script', attrs: { src: `${base}${fileName}` }, injectTo: 'head' })
        }

        // Content-Security-Policy as a <meta> tag so it ships with the build on
        // any host (cPanel included). Hosts that can send headers (Render,
        // vite preview) also send it as a header, with frame-ancestors, which
        // a <meta> policy cannot set.
        tags.push({
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(apiUrl) },
          injectTo: 'head-prepend',
        })

        return tags
      },
    },
    writeBundle(options) {
      if (heroPreload) writeFileSync(join(options.dir, heroPreload.fileName), heroPreload.code)
    },
  }
}

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Local HTTPS with a browser-trusted cert (mkcert). Required so the kiosk
  // QR camera (getUserMedia) works: Chrome only exposes it in a secure context.
  // Dev server only: `vite build` never loads the plugin, so a production build
  // does not need it, and `vite preview` (also reported as 'serve') would only
  // try to download mkcert. Falls back to HTTP when VITE_HTTP=true is set.
  const useMkcert = command === 'serve'
    && !process.argv.includes('preview')
    && process.env.VITE_HTTP !== 'true'
  const mkcertPlugins = useMkcert
    ? [(await import('vite-plugin-mkcert')).default()]
    : []

  return {
    plugins: [react(), tailwindcss(), resourceHints(env.VITE_API_URL), ...mkcertPlugins],

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      headers: securityHeaders,

      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // Proxied too so uploaded images (e.g. avatars) are not blocked as
        // mixed content on the HTTPS dev page.
        '/storage': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },

    // Serves the production build: same headers as Render, CSP included.
    preview: {
      headers: {
        ...securityHeaders,
        'Content-Security-Policy': `${contentSecurityPolicy(env.VITE_API_URL)}; frame-ancestors 'self'`,
      },
    },
  }
})
