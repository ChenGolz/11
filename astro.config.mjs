import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { format: 'file' },
  // Optional: set PUBLIC_SITE_URL in .env to get absolute og:url/canonical.
  site: process.env.PUBLIC_SITE_URL || undefined
});
