import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs separately; requests to /api are proxied to it.
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 5173),
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 4173),
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
