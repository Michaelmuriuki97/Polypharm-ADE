import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: frontendDir,
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        website: resolve(frontendDir, 'index.html'),
        creator: resolve(frontendDir, 'creator.html'),
        clinicalApp: resolve(frontendDir, 'clinical-app.html'),
        about: resolve(frontendDir, 'about.html'),
        objectives: resolve(frontendDir, 'objectives.html'),
        methodology: resolve(frontendDir, 'methodology.html'),
        contact: resolve(frontendDir, 'contact.html'),
      },
    },
  },
});
