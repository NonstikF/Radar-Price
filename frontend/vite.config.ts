import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    // Aquí pegamos exactamente el dominio que te dio el error
    allowedHosts: ['frontend-production-a0cf.up.railway.app'],
    host: true, // Asegura que escuche en todas las IPs (0.0.0.0)
  }
})