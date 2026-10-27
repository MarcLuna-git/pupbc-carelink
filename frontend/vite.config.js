import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Production-only <head> hints. Nothing here changes what the app does; if an
// asset or the API origin cannot be resolved, the hint is simply left out.
const resourceHints = (apiUrl) => {
  let base = '/'
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
        const hero = Object.keys(bundle || {}).find((file) => /(^|\/)pup-binan-hero-[\w-]+\.jpg$/.test(file))
        if (hero) {
          tags.push({
            tag: 'script',
            children: `if(location.pathname==='/'){var l=document.createElement('link');l.rel='preload';l.as='image';l.href='${base}${hero}';l.setAttribute('fetchpriority','high');document.head.appendChild(l)}`,
            injectTo: 'head',
          })
        }

        return tags
      },
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
  }
})
