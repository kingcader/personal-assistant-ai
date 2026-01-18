/**
 * Text Extraction Router
 *
 * Routes file extraction to the appropriate handler based on MIME type.
 * Includes AI vision analysis for images and image-based PDFs.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 * Enhanced in Loop #5.5: AI Vision
 */

import { SUPPORTED_MIME_TYPES, isImageMimeType } from '@/lib/google/drive';
import { extractGoogleDoc } from './google-docs';
import { extractPdf, extractPdfWithVisionFallback } from './pdf';
import { extractTextFile } from './text';
import { extractGoogleSheet } from './sheets';
import { extractImageWithVision } from './vision';

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
 * @param fileName - Optional file name for better AI context
 * @returns Extracted text content
 */
export async function extractTextFromFile(
  fileId: string,
  mimeType: string,
  fileName?: string
): Promise<ExtractionResult> {
  try {
    // Handle images with AI vision
    if (isImageMimeType(mimeType)) {
      const result = await extractImageWithVision(fileId, mimeType, fileName || 'image');
      return {
        success: result.success,
        text: result.text,
        error: result.error,
        metadata: {
          wordCount: countWords(result.text),
        },
      };
    }

    switch (mimeType) {
      case SUPPORTED_MIME_TYPES.GOOGLE_DOC:
        return await extractGoogleDoc(fileId);

      case SUPPORTED_MIME_TYPES.GOOGLE_SHEET:
        return await extractGoogleSheet(fileId);

      case SUPPORTED_MIME_TYPES.PDF:
        // Use PDF extractor with AI vision fallback for image-based PDFs
        return await extractPdfWithVisionFallback(fileId, fileName || 'document.pdf');

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
