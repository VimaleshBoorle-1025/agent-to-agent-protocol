import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/registry': { target: 'http://localhost:3001', rewrite: (p) => p.replace('/api/registry', '') },
      '/api/mailbox':  { target: 'http://localhost:3002', rewrite: (p) => p.replace('/api/mailbox', '') },
      '/api/audit':    { target: 'http://localhost:3003', rewrite: (p) => p.replace('/api/audit', '') },
      '/api/auth':     { target: 'http://localhost:3005', rewrite: (p) => p.replace('/api/auth', '') },
    },
  },
});
