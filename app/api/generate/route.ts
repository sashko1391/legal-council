/**
 * API Route: Document Generation
 * POST /api/generate
 * 
 * FIX #15 (Feb 13, 2026): Added text size validation
 *   — Max 10,000 chars for requirements
 *   — Clear error messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenerationOrchestrator } from '../../../packages/legal-council/orchestrators/generation-orchestrator';
import type { DocumentGenerationRequest } from '../../../packages/legal-council/types/generation-types';

// ==========================================
// NEXT.JS 14 ROUTE SEGMENT CONFIG
// ==========================================

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// FIX #15: Size limits
const MAX_REQUIREMENTS_CHARS = 10_000;
const MIN_REQUIREMENTS_CHARS = 20;

// ==========================================
// POST HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.documentType || typeof body.documentType !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid documentType field' },
        { status: 400 }
      );
    }

    if (!body.requirements || typeof body.requirements !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid requirements field' },
        { status: 400 }
      );
    }

    // FIX #15: Size validation
    const reqLength = body.requirements.length;

    if (reqLength < MIN_REQUIREMENTS_CHARS) {
      return NextResponse.json(
        { error: `Вимоги занадто короткі (${reqLength} символів). Мінімум: ${MIN_REQUIREMENTS_CHARS} символів. Опишіть деталі договору.` },
        { status: 400 }
      );
    }

    if (reqLength > MAX_REQUIREMENTS_CHARS) {
      return NextResponse.json(
        { error: `Вимоги занадто довгі (${reqLength} символів). Максимум: ${MAX_REQUIREMENTS_CHARS} символів. Спробуйте скоротити опис.` },
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
    };

    console.log(`📝 Generation request received: ${generationRequest.documentType}`);

    // Initialize orchestrator
    const orchestrator = new GenerationOrchestrator({
      maxRevisions: 2,
      enableAuditTrail: true,
    });

    // Run generation
    const startTime = Date.now();
    const result = await orchestrator.generate(generationRequest);
    const duration = Date.now() - startTime;

    console.log(`✅ Generation complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`   Cost: $${result.metadata.totalCost.toFixed(4)}`);
    console.log(`   Quality: ${result.qualityMetrics.overall}%`);

    // Return response
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        processingTimeMs: duration,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Generation API error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid API configuration. Please check environment variables.' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      if (error.message.includes('Invalid') || error.message.includes('Missing')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
