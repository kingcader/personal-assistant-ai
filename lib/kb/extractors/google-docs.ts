/**
 * Google Docs Text Extractor
 *
 * Exports Google Docs as plain text via the Drive API.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { exportGoogleDoc } from '@/lib/google/drive';
import type { ExtractionResult } from './index';

/**
 * Extract text from a Google Doc
 *
 * @param fileId - Google Drive file ID
 * @returns Extracted text with metadata
 */
export async function extractGoogleDoc(fileId: string): Promise<ExtractionResult> {
  try {
    const text = await exportGoogleDoc(fileId);

    // Clean up the text
    const cleanedText = cleanGoogleDocText(text);

    // Count words
    const wordCount = cleanedText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    // Detect structure (headings, lists, etc.)
    const hasStructure = detectStructure(cleanedText);

    return {
      success: true,
      text: cleanedText,
      metadata: {
        wordCount,
        hasStructure,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error extracting Google Doc ${fileId}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Clean up Google Doc exported text
 */
function cleanGoogleDocText(text: string): string {
  return (
    text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive blank lines (more than 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace from each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Trim overall
      .trim()
  );
}

/**
 * Detect if the document has structure (headings, lists, etc.)
 */
function detectStructure(text: string): boolean {
  // Check for lines that look like headings (ALL CAPS, underlined, etc.)
  const hasAllCapsHeadings = /^[A-Z][A-Z\s]{5,}$/m.test(text);

  // Check for numbered lists
  const hasNumberedLists = /^\s*\d+[.)]\s+/m.test(text);

  // Check for bullet lists
  const hasBulletLists = /^\s*[-*•]\s+/m.test(text);

  // Check for sections (lines ending with colon followed by content)
  const hasSections = /^[A-Za-z][\w\s]+:\s*$/m.test(text);

  return hasAllCapsHeadings || hasNumberedLists || hasBulletLists || hasSections;
}
