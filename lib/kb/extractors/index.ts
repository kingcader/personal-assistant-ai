/**
 * Text Extraction Router
 *
 * Routes file extraction to the appropriate handler based on MIME type.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { SUPPORTED_MIME_TYPES } from '@/lib/google/drive';
import { extractGoogleDoc } from './google-docs';
import { extractPdf } from './pdf';
import { extractTextFile } from './text';
import { extractGoogleSheet } from './sheets';

/**
 * Result of text extraction
 */
export interface ExtractionResult {
  success: boolean;
  text: string;
  error?: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    hasStructure?: boolean; // Has headings, etc.
  };
}

/**
 * Extract text from a file based on its MIME type
 *
 * @param fileId - Google Drive file ID
 * @param mimeType - MIME type of the file
 * @returns Extracted text content
 */
export async function extractTextFromFile(
  fileId: string,
  mimeType: string
): Promise<ExtractionResult> {
  try {
    switch (mimeType) {
      case SUPPORTED_MIME_TYPES.GOOGLE_DOC:
        return await extractGoogleDoc(fileId);

      case SUPPORTED_MIME_TYPES.GOOGLE_SHEET:
        return await extractGoogleSheet(fileId);

      case SUPPORTED_MIME_TYPES.PDF:
        return await extractPdf(fileId);

      case SUPPORTED_MIME_TYPES.TEXT_PLAIN:
      case SUPPORTED_MIME_TYPES.TEXT_MARKDOWN:
      case SUPPORTED_MIME_TYPES.TEXT_CSV:
      case SUPPORTED_MIME_TYPES.TEXT_HTML:
        return await extractTextFile(fileId, mimeType);

      default:
        return {
          success: false,
          text: '',
          error: `Unsupported MIME type: ${mimeType}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error extracting text from ${fileId}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Estimate word count from text
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Check if text has structure (headings, lists, etc.)
 */
export function hasStructure(text: string): boolean {
  // Check for markdown-style headings
  const hasMarkdownHeadings = /^#{1,6}\s+/m.test(text);

  // Check for numbered/bulleted lists
  const hasLists = /^[\s]*[-*•]\s+/m.test(text) || /^[\s]*\d+[.)]\s+/m.test(text);

  // Check for all-caps lines (often headings in plain text)
  const hasAllCapsLines = /^[A-Z\s]{10,}$/m.test(text);

  return hasMarkdownHeadings || hasLists || hasAllCapsLines;
}

export { extractGoogleDoc } from './google-docs';
export { extractPdf } from './pdf';
export { extractTextFile } from './text';
export { extractGoogleSheet } from './sheets';
