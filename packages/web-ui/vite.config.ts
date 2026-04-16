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
  define: {
    // Injected at build time — Vite replaces these strings in the bundle
    'import.meta.env.VITE_REGISTRY_URL':  JSON.stringify(process.env.VITE_REGISTRY_URL  || ''),
    'import.meta.env.VITE_MAILBOX_URL':   JSON.stringify(process.env.VITE_MAILBOX_URL   || ''),
    'import.meta.env.VITE_AUDIT_URL':     JSON.stringify(process.env.VITE_AUDIT_URL     || ''),
  },
});
