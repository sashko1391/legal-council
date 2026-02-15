/**
 * API Route: File Upload
 * POST /api/upload
 * 
 * Accepts PDF, DOCX, or TXT files via multipart/form-data.
 * Returns extracted text that can be used for contract review.
 * 
 * Usage from frontend:
 *   const formData = new FormData();
 *   formData.append('file', file);
 *   const res = await fetch('/api/upload', { method: 'POST', body: formData });
 *   const { text, metadata } = await res.json();
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseFile, validateFileSize } from '../../../packages/legal-council/services/file-parser';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE_MB = 10;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Файл не знайдено. Надішліть файл у полі "file".' },
        { status: 400 }
      );
    }

    // Validate file size
    validateFileSize(file.size, MAX_FILE_SIZE_MB);

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file
    const result = await parseFile(buffer, file.name);

    console.log(`📄 File uploaded and parsed: ${file.name} → ${result.metadata.charCount} chars`);

    return NextResponse.json({
      success: true,
      text: result.text,
      metadata: result.metadata,
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    const message = error instanceof Error
      ? error.message
      : 'Не вдалося обробити файл.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
