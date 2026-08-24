import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MirrorSite AI - Clone Any Website with AI';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '60px 80px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              background: 'linear-gradient(to right, #f97316, #ec4899)',
              backgroundClip: 'text',
              color: 'transparent',
              margin: 0,
              marginBottom: '20px',
            }}
          >
            MirrorSite AI
          </h1>
          <p
            style={{
              fontSize: '32px',
              color: '#374151',
              margin: 0,
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            Clone Any Website with AI
          </p>
          <p
            style={{
              fontSize: '24px',
              color: '#6b7280',
              margin: 0,
              marginTop: '20px',
            }}
          >
            Transform designs into production-ready code
          </p>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '20px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontWeight: '600',
          }}
        >
          mirrorsiteai.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
