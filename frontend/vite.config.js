import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // SPA fallback — mọi route (/admin, etc.) đều dùng index.html
  appType: 'spa',
})
