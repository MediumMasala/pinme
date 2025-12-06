import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ledger-ui/',
  server: {
    proxy: {
      '/ledger': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../public/ledger',
    emptyOutDir: true,
  },
});
