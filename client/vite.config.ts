import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
          proxy.on('proxyReq', (_proxyReq, req) => {
            if (!req.url) return;
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
          proxy.on('proxyReqWs', () => {});
        },
      },
    },
  },
});
