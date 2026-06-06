import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      strictPort: true,
      hmr: {
        host: 'localhost',
        protocol: 'ws'
      },
      watch: {
        usePolling: true
      }
    },
  };
});
