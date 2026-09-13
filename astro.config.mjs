import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'static',
  integrations: [preact()],
  image: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pub-35ea86b0ed4d42faa0204b40a5d5ea16.r2.dev' },
      // Placeholders dos .md de exemplo (inferSize busca no build; URL 404 do R2 quebraria a compilação).
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'i.picsum.photos' },
    ],
  },
});
