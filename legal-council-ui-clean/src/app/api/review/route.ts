/**
 * API Route: Contract Review (Proxy to Real Backend)
 * POST /api/review
 *
 * FIX #1 (Feb 13, 2026):
 * Replaced mock API (generateMockRisks) with a proxy that forwards
 * requests to the real backend ReviewOrchestrator.
 *
 * Set NEXT_PUBLIC_API_URL or BACKEND_URL in .env to point to the
 * backend server (e.g., http://localhost:3000 for the root Next.js app).
 */

import { NextRequest, NextResponse } from 'next/server'

// Route config
export const maxDuration = 300 // 5 min for complex contracts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate
    if (!body.contractText || typeof body.contractText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid contractText field' },
        { status: 400 }
      )
    }

    console.log(`📋 Review request: ${body.contractText.length} chars, type: ${body.contractType || 'unknown'}`)

    // Determine backend URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL

    if (!backendUrl) {
      console.error('❌ No backend URL configured')
      return NextResponse.json(
        {
          error:
            'Бекенд не налаштований. Встановіть NEXT_PUBLIC_API_URL або BACKEND_URL в .env (наприклад: http://localhost:3000)',
        },
        { status: 503 }
      )
    }

    // Proxy to real backend
    const apiUrl = `${backendUrl}/api/review`
    console.log(`🔗 Proxying to: ${apiUrl}`)

    const backendResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractText: body.contractText,
        contractType: body.contractType,
        jurisdiction: body.jurisdiction || 'Ukraine',
        specificQuestions: body.specificQuestions,
        focusAreas: body.focusAreas,
      }),
    })

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}))
      console.error('❌ Backend error:', backendResponse.status, errorData)
      return NextResponse.json(
        { error: errorData.error || `Помилка бекенду: ${backendResponse.status}` },
        { status: backendResponse.status }
      )
    }

    const data = await backendResponse.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Review proxy error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
