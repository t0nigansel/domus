import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend calls the API under the same origin (/api).
// In development and preview, Vite forwards those requests to the API server.
const apiProxy = {
  '/api': process.env.DOMUS_API_URL || 'http://localhost:3001',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
})
