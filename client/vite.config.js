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
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
        // Suppress proxy errors in console
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Silently handle expected WS reconnection errors
          });
        },
      },
    },
    // Separate Vite HMR WebSocket to avoid conflicts with Socket.IO
    hmr: {
      port: 5174,
    },
  },
});
