import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// robots.txt gets a Sitemap line pointing at the API's sitemap (RE-L-09), taken
// from VITE_API_URL at build time so no host is hard-coded.
function robotsSitemap(apiUrl) {
  return {
    name: 'robots-sitemap',
    apply: 'build',
    generateBundle(_, bundle) {
      const asset = Object.values(bundle).find((f) => f.fileName === 'robots.txt');
      if (!asset || !apiUrl || /Sitemap:/i.test(String(asset.source))) return;
      asset.source = `${String(asset.source).trimEnd()}\nSitemap: ${apiUrl.replace(/\/$/, '')}/sitemap.xml\n`;
    },
    async closeBundle() {
      // public/ files are copied as-is, not as bundle assets, so patch the written file too.
      if (!apiUrl) return;
      const fs = await import('node:fs/promises');
      const file = fileURLToPath(new URL('./dist/robots.txt', import.meta.url));
      try {
        const text = await fs.readFile(file, 'utf8');
        if (!/Sitemap:/i.test(text)) await fs.writeFile(file, `${text.trimEnd()}\nSitemap: ${apiUrl.replace(/\/$/, '')}/sitemap.xml\n`);
      } catch { /* custom outDir or no robots.txt: nothing to do */ }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), robotsSitemap(env.VITE_API_URL)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5182, strictPort: true },
    preview: { port: 5182 },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.js'],
      include: ['tests/**/*.test.{js,jsx}'],
    },
  };
});
