import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(async ({ command }) => {
  // Local HTTPS with a browser-trusted cert (mkcert). Required so the kiosk
  // QR camera (getUserMedia) works: Chrome only exposes it in a secure context.
  // Dev server only: `vite build` never loads the plugin, so a production build
  // does not need it. Falls back to HTTP when VITE_HTTP=true is set.
  const useMkcert = command === 'serve' && process.env.VITE_HTTP !== 'true'
  const mkcertPlugins = useMkcert
    ? [(await import('vite-plugin-mkcert')).default()]
    : []

  return {
    plugins: [react(), tailwindcss(), ...mkcertPlugins],

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
