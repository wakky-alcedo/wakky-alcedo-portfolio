import type { APIRoute } from 'astro';

/** robots.txt（sitemap の URL は astro.config.mjs の site から作る） */
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap-index.xml', site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl.href}\n`);
};
