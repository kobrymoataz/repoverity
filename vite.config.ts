import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages is deployed at /repoverity/, locally the app stays at /.
  base: process.env.PAGES_BASE || '/',
})
