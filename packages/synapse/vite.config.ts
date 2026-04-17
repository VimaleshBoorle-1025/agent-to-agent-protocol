import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // AAP Protocol infrastructure
      '/api/registry': { target: 'http://localhost:3001', rewrite: p => p.replace('/api/registry', '') },
    },
  },
  define: {
    'import.meta.env.VITE_REGISTRY_URL': JSON.stringify(process.env.VITE_REGISTRY_URL || ''),
  },
});
