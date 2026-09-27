import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@/..." apunta a src/, como esperan los componentes estilo shadcn.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
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