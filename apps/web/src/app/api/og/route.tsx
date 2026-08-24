import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'Eyano';
  const subtitle = searchParams.get('subtitle') || 'Assistant intelligent propulse par Gnoxe AI';

  const logoPath = join(process.cwd(), 'public', 'icon-512.png');
  const logoData = await readFile(logoPath);
  const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050505',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(57,255,20,0.12) 0%, transparent 70%)',
          }}
        />

        <img
          src={logoBase64}
          width={120}
          height={120}
          style={{
            borderRadius: '28px',
            border: '2px solid rgba(57,255,20,0.2)',
            marginBottom: '32px',
            position: 'relative',
            zIndex: 1,
          }}
        />

        <div
          style={{
            fontSize: '64px',
            fontWeight: '800',
            color: '#F2FFF0',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-2px',
            marginBottom: '16px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: '22px',
            fontWeight: '400',
            color: 'rgba(242,255,240,0.4)',
            fontFamily: 'system-ui, sans-serif',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {subtitle}
        </div>

        <div
          style={{
            width: '80px',
            height: '3px',
            borderRadius: '2px',
            backgroundColor: 'rgba(57,255,20,0.4)',
            marginTop: '24px',
            position: 'relative',
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '16px',
            fontWeight: '500',
            color: 'rgba(242,255,240,0.2)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          eyano.site
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
