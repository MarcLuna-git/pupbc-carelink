import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Local HTTPS with a browser-trusted cert (mkcert). Required so the kiosk
    // QR camera (getUserMedia) works: Chrome only exposes it in a secure context.
    // Falls back to HTTP when VITE_HTTP=true is set in the environment.
    ...(process.env.VITE_HTTP === 'true' ? [] : [mkcert()]),
  ],

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
})