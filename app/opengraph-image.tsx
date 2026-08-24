import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt =
  'MirrorSite AI — AI-Powered Website Analysis, Interface Recreation and Code Generation';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, #09090b 0%, #18181b 45%, #1c0f08 100%)',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(249,115,22,0.35) 0%, rgba(249,115,22,0) 70%)',
            top: '-300px',
            right: '-150px',
            display: 'flex',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(236,72,153,0.22) 0%, rgba(236,72,153,0) 70%)',
            bottom: '-250px',
            left: '-150px',
            display: 'flex',
          }}
        />

        {/* Decorative grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '45px 45px',
            display: 'flex',
          }}
        />

        {/* Main content */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '70px 85px',
            position: 'relative',
          }}
        >
          {/* Brand badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              padding: '12px 22px',
              borderRadius: '999px',
              backgroundColor: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.45)',
              color: '#fb923c',
              fontSize: '22px',
              fontWeight: 700,
              marginBottom: '28px',
            }}
          >
            AI-POWERED WEB DEVELOPMENT
          </div>

          {/* Product name */}
          <div
            style={{
              display: 'flex',
              fontSize: '82px',
              fontWeight: 800,
              letterSpacing: '-4px',
              color: '#ffffff',
              lineHeight: 1,
              marginBottom: '26px',
            }}
          >
            MirrorSite{' '}
            <span
              style={{
                color: '#fb923c',
                marginLeft: '20px',
              }}
            >
              AI
            </span>
          </div>

          {/* Main description */}
          <div
            style={{
              display: 'flex',
              maxWidth: '920px',
              fontSize: '38px',
              lineHeight: 1.2,
              color: '#f4f4f5',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            Analyze websites. Recreate interfaces. Generate code with AI.
          </div>

          {/* Supporting description */}
          <div
            style={{
              display: 'flex',
              maxWidth: '850px',
              fontSize: '24px',
              lineHeight: 1.4,
              color: '#a1a1aa',
            }}
          >
            Turn website references, designs and ideas into new web experiences.
          </div>

          {/* Bottom section */}
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              bottom: '55px',
              left: '85px',
              right: '85px',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                color: '#71717a',
                fontSize: '20px',
                fontWeight: 600,
              }}
            >
              Developed by ATAI Enterprises • VettCode
            </div>

            <div
              style={{
                display: 'flex',
                color: '#fb923c',
                fontSize: '21px',
                fontWeight: 700,
              }}
            >
              mirrorsiteai.vercel.app
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

