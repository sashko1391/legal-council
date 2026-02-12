/**
 * API Route: Contract Review
 * POST /api/review
 * 
 * Accepts contract text, runs 4-agent analysis, returns comprehensive report
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReviewOrchestrator } from '../../../packages/legal-council/orchestrators/review-orchestrator';
import type { ContractReviewRequest } from '../../../packages/legal-council/types/review-types';

// Disable body size limit for large contracts
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.contractText || typeof body.contractText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid contractText field' },
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

    // Handle specific error types
    if (error instanceof Error) {
      // API key errors
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid API configuration. Please check environment variables.' },
          { status: 500 }
        );
      }

      // Rate limit errors
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }

      // Generic error
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Unknown error
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET method not supported
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
