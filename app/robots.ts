import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://vettcode.dev';

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
