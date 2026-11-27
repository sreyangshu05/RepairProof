import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (/\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id))
            return 'framework';
          if (id.includes('/@tanstack/')) return 'query';
          if (id.includes('/lucide-react/')) return 'icons';
          if (/\/(react-hook-form|zod)\//.test(id)) return 'forms';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@repairproof/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
