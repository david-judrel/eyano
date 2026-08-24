import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ASSETS = [
  '/update',
  '/api',
  '/_next',
  '/icon',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ASSETS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(new URL('/update', request.url));
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
