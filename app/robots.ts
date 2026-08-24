import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://mirrorsiteai.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/builder',
          '/search',
          '/generation',
          '/pricing',
          '/login',
          '/signup',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/tokens',
          '/models',
          '/*.json$',
          '/admin',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/about',
          '/builder',
          '/search',
          '/generation',
          '/pricing',
          '/login',
          '/signup',
          '/privacy',
          '/terms',
        ],
        disallow: ['/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
