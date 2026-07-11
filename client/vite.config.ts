import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    hmr: {
      // Silently handle HMR client disconnects
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            const error = err as Error & { code?: string };
            const method = req.method || 'UNKNOWN';
            const url = req.url || '/api';
            const reason = error.code || error.message;

            console.warn(`[vite proxy] ${method} ${url} -> http://localhost:5000 failed: ${reason}`);
          });
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
          // Suppress ALL proxy-level errors (ECONNABORTED, ECONNRESET, EPIPE, etc.)
          proxy.on('error', () => {});
          proxy.on('proxyReqWs', (_proxyReq, req, socket: import('net').Socket) => {
            // Suppress errors on the incoming browser socket (the source of ECONNABORTED)
            socket.on('error', () => {});
            req.on('error', () => {});
          });
          // Suppress write errors on the outgoing proxied socket to the backend
          proxy.on('open', (proxySocket: import('net').Socket) => {
            proxySocket.on('error', () => {});
          });
          proxy.on('proxyRes', (_proxyRes, _req, res) => {
            res.on('error', () => {});
          });
        },
      },
    },
  },
});
