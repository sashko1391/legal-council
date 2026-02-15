/**
 * API Route: Export Report as HTML (for Print-to-PDF)
 * POST /api/export/pdf
 * 
 * Returns a complete HTML page styled for printing.
 * The frontend opens it in a new tab and triggers window.print().
 * This approach avoids server-side puppeteer dependency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateReportHTML } from '../../../../packages/legal-council/services/pdf-export';
import type { ReportData } from '../../../../packages/legal-council/services/pdf-export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.type || !['review', 'generation'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Missing or invalid "type" field. Expected: "review" or "generation".' },
        { status: 400 }
      );
    }

    const reportData: ReportData = body as ReportData;
    const html = generateReportHTML(reportData);

    // Return HTML with proper content type
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('❌ Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
