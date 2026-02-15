/**
 * File Parser Service
 * 
 * Extracts plain text from uploaded PDF and DOCX files.
 * Used by the /api/upload endpoint.
 * 
 * Dependencies:
 *   npm install pdf-parse mammoth
 */

import { logger } from '../utils/logger';

// ==========================================
// TYPES
// ==========================================

export interface ParseResult {
  text: string;
  metadata: {
    fileName: string;
    fileType: 'pdf' | 'docx' | 'txt';
    fileSize: number;
    charCount: number;
    pageCount?: number;
  };
}

// ==========================================
// PARSERS
// ==========================================

/**
 * Parse a PDF file and extract text content.
 */
async function parsePDF(buffer: Buffer, fileName: string): Promise<ParseResult> {
  try {
    // Dynamic import with `as any` — pdf-parse types are inconsistent between CJS/ESM
    const mod = await import('pdf-parse') as any;
    const pdfParse = mod.default ?? mod;

    const result = await pdfParse(buffer, {
      max: 200, // max pages to prevent OOM
    });

    const text = (result.text || '').trim();

    if (!text) {
      throw new Error('PDF не містить тексту. Можливо, це сканований документ — спробуйте скопіювати текст вручну.');
    }

    return {
      text,
      metadata: {
        fileName,
        fileType: 'pdf',
        fileSize: buffer.length,
        charCount: text.length,
        pageCount: result.numpages,
      },
    };
  } catch (error) {
    if ((error as Error).message.includes('не містить тексту')) {
      throw error;
    }
    logger.warn(`PDF parse error for ${fileName}: ${(error as Error).message}`);
    throw new Error(`Не вдалося розпарсити PDF: ${(error as Error).message}`);
  }
}

/**
 * Parse a DOCX file and extract text content.
 */
async function parseDOCX(buffer: Buffer, fileName: string): Promise<ParseResult> {
  try {
    const mod = await import('mammoth') as any;
    const mammoth = mod.default ?? mod;

    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();

    if (!text) {
      throw new Error('DOCX файл порожній або не містить тексту.');
    }

    if (result.messages && result.messages.length > 0) {
      logger.info(`DOCX conversion warnings for ${fileName}: ${result.messages.length} warnings`);
    }

    return {
      text,
      metadata: {
        fileName,
        fileType: 'docx',
        fileSize: buffer.length,
        charCount: text.length,
      },
    };
  } catch (error) {
    if ((error as Error).message.includes('порожній')) {
      throw error;
    }
    logger.warn(`DOCX parse error for ${fileName}: ${(error as Error).message}`);
    throw new Error(`Не вдалося розпарсити DOCX: ${(error as Error).message}`);
  }
}

/**
 * Parse a plain text file.
 */
function parseTXT(buffer: Buffer, fileName: string): ParseResult {
  const text = buffer.toString('utf-8').trim();

  if (!text) {
    throw new Error('Файл порожній.');
  }

  return {
    text,
    metadata: {
      fileName,
      fileType: 'txt',
      fileSize: buffer.length,
      charCount: text.length,
    },
  };
}

// ==========================================
// MAIN PARSER
// ==========================================

/**
 * Parse an uploaded file based on its extension.
 * Supports: .pdf, .docx, .doc, .txt
 */
export async function parseFile(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  
  logger.info(`Parsing file: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB, type: .${ext})`);

  switch (ext) {
    case 'pdf':
      return parsePDF(buffer, fileName);

    case 'docx':
    case 'doc':
      return parseDOCX(buffer, fileName);

    case 'txt':
    case 'text':
      return parseTXT(buffer, fileName);

    default:
      throw new Error(
        `Непідтримуваний формат файлу: .${ext}. Підтримуються: .pdf, .docx, .txt`
      );
  }
}

/**
 * Validate file size before parsing.
 */
export function validateFileSize(size: number, maxSizeMB: number = 10): void {
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    throw new Error(
      `Файл занадто великий (${(size / 1024 / 1024).toFixed(1)}MB). Максимум: ${maxSizeMB}MB.`
    );
  }
  if (size === 0) {
    throw new Error('Файл порожній.');
  }
}
