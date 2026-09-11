import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const codespacesHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : undefined;

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['ghcp-ai-credits-simulator-shared/governanceControls'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /shared\/governanceControls\.js$/],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: '::',
    strictPort: true,
    allowedHosts: codespacesHost ? [codespacesHost] : [],
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
    },
  },
});
