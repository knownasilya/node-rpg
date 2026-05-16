import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site at /<repo>/; dev still uses /.
  base: command === 'build' ? '/node-rpg/' : '/',
  plugins: [preact()],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  server: {
    port: 3000,
  },
}));
