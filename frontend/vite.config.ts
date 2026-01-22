import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,
    port: 4173,
    allowedHosts: [
      'frontend-production-a0cf.up.railway.app', // Tu Producción (Ya estaba)
      'frontend-staging-0a8e.up.railway.app',    // Tu Staging (NUEVO)
      'localhost'                                 // Opcional, para local
    ]
  }
})