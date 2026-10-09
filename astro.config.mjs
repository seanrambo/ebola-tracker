// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: process.env.URL ?? 'https://ebola-tracker.netlify.app',
	trailingSlash: 'ignore',
});
