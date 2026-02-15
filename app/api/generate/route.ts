/**
 * API Route: Document Generation with SSE Streaming
 * POST /api/generate
 * 
 * v3: SSE streaming for real-time agent progress
 *   — Returns text/event-stream with agent_start/agent_complete/result events
 *   — Special handling for clarification flow (non-SSE JSON response)
 *   — For clarification responses, returns regular JSON (not SSE)
 *   — For generation, returns SSE stream
 * 
 * Previous fixes preserved:
 *   FIX #15: Text size validation
 *   Pre-Generation Gate with clarification flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenerationOrchestrator } from '../../../packages/legal-council/orchestrators/generation-orchestrator';
import type { ClarificationResponse } from '../../../packages/legal-council/orchestrators/generation-orchestrator';
import type { DocumentGenerationRequest } from '../../../packages/legal-council/types/generation-types';
import { createSSEStream, createSSEResponse } from '../../../packages/legal-council/utils/sse-helpers';

// ==========================================
// NEXT.JS 14 ROUTE SEGMENT CONFIG
// ==========================================

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Size limits
const MAX_REQUIREMENTS_CHARS = 10_000;
const MIN_REQUIREMENTS_CHARS = 20;

// Type guard
function isClarificationResponse(result: any): result is ClarificationResponse {
  return result && result.status === 'needs_clarification';
}

// ==========================================
// POST HANDLER — SSE Streaming
// ==========================================

export async function POST(request: NextRequest) {
  // Parse and validate
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.documentType || typeof body.documentType !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid documentType field' }, { status: 400 });
  }

  if (!body.requirements || typeof body.requirements !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid requirements field' }, { status: 400 });
  }

  const reqLength = body.requirements.length;

  if (reqLength < MIN_REQUIREMENTS_CHARS) {
    return NextResponse.json(
      { error: `Вимоги занадто короткі (${reqLength} символів). Мінімум: ${MIN_REQUIREMENTS_CHARS} символів.` },
      { status: 400 }
    );
  }

  if (reqLength > MAX_REQUIREMENTS_CHARS) {
    return NextResponse.json(
      { error: `Вимоги занадто довгі (${reqLength} символів). Максимум: ${MAX_REQUIREMENTS_CHARS} символів.` },
      { status: 400 }
    );
  }

  // Build request
  const generationRequest: DocumentGenerationRequest = {
    documentType: body.documentType,
    requirements: body.requirements,
    jurisdiction: body.jurisdiction || 'Ukraine',
    parties: body.parties,
    specificClauses: body.specificClauses,
    template: body.template || 'balanced',
    clarificationAnswers: body.clarificationAnswers,
  };

  console.log(`📝 Generation request received: ${generationRequest.documentType} — SSE mode`);

  // Check if this might be a first pass (no clarification answers yet)
  // We need to handle the case where Analyzer returns needs_clarification
  // In that case we return regular JSON, not SSE

  // Strategy: Always use SSE. If clarification needed, send it as a 'clarification' event.
  const stream = createSSEStream(async (send, onProgress) => {
    const orchestrator = new GenerationOrchestrator({
      maxRevisions: 2,
      enableAuditTrail: true,
    });

    const result = await orchestrator.generate(generationRequest, onProgress);

    if (isClarificationResponse(result)) {
      // Send clarification as a special event
      send({
        type: 'gate_check',
        message: result.message,
        data: {
          status: 'needs_clarification',
          questions: result.questions,
          partialAnalysis: result.partialAnalysis,
          message: result.message,
        },
      });
    } else {
      // Send the full generated document
      send({
        type: 'result',
        data: {
          success: true,
          status: 'completed',
          data: result,
        },
      });
    }
  });

  return createSSEResponse(stream);
}
