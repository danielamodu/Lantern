import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_WRITES = 20;
const RATE_LIMIT_MAX_READS = 60;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;
  const ip = getClientIp(request);

  if (pathname.startsWith('/api/')) {
    const readOnlyRoutes = ['/api/events', '/api/assets/list']; // decrypt removed (deleted), generate-keys is write ops
    const isReadOnly = readOnlyRoutes.some(route => pathname.startsWith(route));
    const maxRequests = isReadOnly ? RATE_LIMIT_MAX_READS : RATE_LIMIT_MAX_WRITES;

    if (isRateLimited(ip, maxRequests)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*'
};
