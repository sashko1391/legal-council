/**
 * API Route: Contract Review with SSE Streaming
 * POST /api/review
 * 
 * v3: SSE streaming for real-time agent progress
 *   — Returns text/event-stream with agent_start/agent_complete/result events
 *   — Frontend reads stream with fetch + getReader()
 * 
 * Previous fixes preserved:
 *   FIX #15: Contract text size validation
 */

import { NextRequest } from 'next/server';
import { ReviewOrchestrator } from '../../../packages/legal-council/orchestrators/review-orchestrator';
import { createSSEStream, createSSEResponse } from '../../../packages/legal-council/utils/sse-helpers';
import type { ContractReviewRequest } from '../../../packages/legal-council/types/review-types';

// ==========================================
// NEXT.JS 14 ROUTE SEGMENT CONFIG
// ==========================================

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Size limits
const MAX_CONTRACT_CHARS = 50_000;
const MIN_CONTRACT_CHARS = 50;

// ==========================================
// POST HANDLER — SSE Streaming
// ==========================================

export async function POST(request: NextRequest) {
  // Parse and validate request body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate required fields
  if (!body.contractText || typeof body.contractText !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid contractText field' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Size validation
  const textLength = body.contractText.length;

  if (textLength < MIN_CONTRACT_CHARS) {
    return new Response(
      JSON.stringify({ error: `Текст контракту занадто короткий (${textLength} символів). Мінімум: ${MIN_CONTRACT_CHARS} символів.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (textLength > MAX_CONTRACT_CHARS) {
    return new Response(
      JSON.stringify({ error: `Текст контракту занадто довгий (${textLength} символів). Максимум: ${MAX_CONTRACT_CHARS} символів (~25 сторінок). Будь ласка, розділіть документ на частини.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build review request
  const reviewRequest: ContractReviewRequest = {
    contractText: body.contractText,
    contractType: body.contractType,
    jurisdiction: body.jurisdiction || 'Ukraine',
    specificQuestions: body.specificQuestions,
    focusAreas: body.focusAreas,
  };

  console.log(`📋 Review request received (${reviewRequest.contractText.length} chars) — SSE mode`);

  // Create SSE stream
  const stream = createSSEStream(async (send, onProgress) => {
    const orchestrator = new ReviewOrchestrator({
      maxRounds: 3,
      maxSeverityThreshold: 3,
      minConfidence: 0.85,
      enableAuditTrail: true,
    });

    const startTime = Date.now();
    const result = await orchestrator.analyze(reviewRequest, onProgress);
    const duration = Date.now() - startTime;

    console.log(`✅ Review complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`   Cost: $${result.metadata.totalCost.toFixed(4)}`);

    // Send the full result
    send({
      type: 'result',
      data: {
        success: true,
        data: result,
        metadata: {
          processingTimeMs: duration,
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  return createSSEResponse(stream);
}
