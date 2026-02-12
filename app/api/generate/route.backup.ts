/**
 * API Route: Document Generation
 * POST /api/generate
 * 
 * Accepts requirements, generates ДСТУ-compliant Ukrainian contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenerationOrchestrator } from '../../../packages/legal-council/orchestrators/generation-orchestrator';
import type { DocumentGenerationRequest } from '../../../packages/legal-council/types/generation-types';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
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

      // Validation errors
      if (error.message.includes('Invalid') || error.message.includes('Missing')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
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
