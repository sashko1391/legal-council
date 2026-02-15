/**
 * Frontend Proxy: Review API (SSE Passthrough)
 * POST /api/review
 * 
 * Proxies to the backend ReviewOrchestrator at NEXT_PUBLIC_API_URL/api/review.
 * Passes through the SSE stream directly to the client.
 * 
 * Also handles /api/upload proxy for file uploads.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const body = await request.json();

    const apiUrl = `${backendUrl}/api/review`;
    console.log(`[UI Proxy] POST ${apiUrl} (SSE passthrough)`);

    const backendResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // If backend returned an error (non-SSE), forward it as JSON
    if (!backendResponse.ok && backendResponse.headers.get('content-type')?.includes('application/json')) {
      const errorData = await backendResponse.json();
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    // If backend returned SSE stream, pass it through
    if (backendResponse.body) {
      return new Response(backendResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Fallback: try to return as JSON
    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error) {
    console.error('[UI Proxy] Review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy error' },
      { status: 502 }
    );
  }
}
