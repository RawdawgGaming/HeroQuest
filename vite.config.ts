import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/HeroQuest/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
