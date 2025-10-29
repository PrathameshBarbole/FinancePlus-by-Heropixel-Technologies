import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 22081,
    strictPort: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:12001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          charts: ['recharts'],
          utils: ['axios', 'i18next', 'react-i18next']
        }
      }
    }
  },
  define: {
    'process.env': {}
  }
})