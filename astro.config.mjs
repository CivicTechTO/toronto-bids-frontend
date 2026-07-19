// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// SITE_URL / BASE_PATH let CI build the fixture site at BASE_PATH=/ while
// production deploys under the GitHub Pages project path. Default build.format
// ('directory') gives the spec's trailing-slash URLs.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://civictechto.github.io',
  base: process.env.BASE_PATH ?? '/toronto-bids-frontend',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
