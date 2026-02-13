/**
 * API Route: Contract Review
 * POST /api/review
 * 
 * FIX #15 (Feb 13, 2026): Added contract text size validation
 *   — Max 50,000 chars (~25 pages) to prevent context window overflow
 *   — Clear Ukrainian error message for users
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReviewOrchestrator } from '../../../packages/legal-council/orchestrators/review-orchestrator';
import type { ContractReviewRequest } from '../../../packages/legal-council/types/review-types';

// ==========================================
// NEXT.JS 14 ROUTE SEGMENT CONFIG
// ==========================================

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// FIX #15: Size limits
const MAX_CONTRACT_CHARS = 50_000; // ~25 pages, fits in most LLM context windows
const MIN_CONTRACT_CHARS = 50;     // At least something meaningful

// ==========================================
// POST HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.contractText || typeof body.contractText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid contractText field' },
        { status: 400 }
      );
    }

    // FIX #15: Size validation
    const textLength = body.contractText.length;

    if (textLength < MIN_CONTRACT_CHARS) {
      return NextResponse.json(
        { error: `Текст контракту занадто короткий (${textLength} символів). Мінімум: ${MIN_CONTRACT_CHARS} символів.` },
        { status: 400 }
      );
    }

    if (textLength > MAX_CONTRACT_CHARS) {
      return NextResponse.json(
        { error: `Текст контракту занадто довгий (${textLength} символів). Максимум: ${MAX_CONTRACT_CHARS} символів (~25 сторінок). Будь ласка, розділіть документ на частини.` },
        { status: 400 }
      );
    }

    // Build request
    const reviewRequest: ContractReviewRequest = {
      contractText: body.contractText,
      contractType: body.contractType,
      jurisdiction: body.jurisdiction || 'Ukraine',
      specificQuestions: body.specificQuestions,
      focusAreas: body.focusAreas,
    };

    console.log(`📋 Review request received (${reviewRequest.contractText.length} chars)`);

    // Initialize orchestrator
    const orchestrator = new ReviewOrchestrator({
      maxRounds: 3,
      maxSeverityThreshold: 3,
      minConfidence: 0.85,
      enableAuditTrail: true,
    });

    // Run analysis
    const startTime = Date.now();
    const result = await orchestrator.analyze(reviewRequest);
    const duration = Date.now() - startTime;

    console.log(`✅ Review complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`   Cost: $${result.metadata.totalCost.toFixed(4)}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);

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
    console.error('❌ Review API error:', error);

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
