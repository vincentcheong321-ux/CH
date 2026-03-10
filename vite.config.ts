import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome >= 60', 'android >= 10'],
      modernTargets: ['chrome >= 70'],
    }),
  ],
  build: {
    outDir: 'dist',
  }
})