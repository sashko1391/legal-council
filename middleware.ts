/**
 * Next.js Middleware — CORS Support
 * 
 * FIX #19 (Feb 13, 2026): Adds CORS headers to /api/* routes
 * so the frontend on a different port/domain can reach the backend.
 * 
 * Place this file at the root of the backend project: middleware.ts
 */

import { NextRequest, NextResponse } from 'next/server';

// Allowed origins — add production domain when deploying
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  // Add production origins here:
  // 'https://agentis.legal',
  // 'https://app.agentis.legal',
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';

  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    setCorsHeaders(response, origin);
    return response;
  }

  // Normal requests: add CORS headers to response
  const response = NextResponse.next();
  setCorsHeaders(response, origin);
  return response;
}

function setCorsHeaders(response: NextResponse, origin: string): void {
  // Allow specific origins (or wildcard for dev)
  if (ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow any origin
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
}

// Only run on API routes
export const config = {
  matcher: '/api/:path*',
};
