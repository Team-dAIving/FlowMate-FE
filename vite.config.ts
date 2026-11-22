import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Writes dist/flowmate-config.json so the packaged Electron main process knows the API origin
 * (it attaches the JWT only to that origin; see electron/auth.cjs). Same source as import.meta.env.
 */
function electronConfig(apiBaseUrl: string): Plugin {
  return {
    name: 'flowmate-electron-config',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'flowmate-config.json',
        source: JSON.stringify({ apiBaseUrl }, null, 2),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), electronConfig(env.VITE_API_BASE_URL ?? '')],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
