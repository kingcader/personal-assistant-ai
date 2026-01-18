/**
 * PDF Text Extractor
 *
 * Extracts text from PDF files using pdf-parse.
 * Falls back to AI vision for image-based PDFs with no extractable text.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 * Enhanced in Loop #5.5: AI Vision Fallback
 */

import { downloadFile } from '@/lib/google/drive';
import { analyzePdfWithVision } from './vision';

// Define ExtractionResult locally to avoid circular import
export interface ExtractionResult {
  success: boolean;
  text: string;
  error?: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    hasStructure?: boolean;
  };
}

// Dynamic import of pdf-parse to handle Node.js environment
let pdfParse: typeof import('pdf-parse') | null = null;

async function getPdfParse() {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse')).default;
  }
  return pdfParse;
}

/**
 * Extract text from a PDF file
 *
 * @param fileId - Google Drive file ID
 * @returns Extracted text with metadata
 */
export async function extractPdf(fileId: string): Promise<ExtractionResult> {
  try {
    // Download the PDF file
    const buffer = await downloadFile(fileId);

    // Parse the PDF
    const pdf = await getPdfParse();
    const data = await pdf(buffer);

    // Clean up the text
    const cleanedText = cleanPdfText(data.text);

    // Count words
    const wordCount = cleanedText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      success: true,
      text: cleanedText,
      metadata: {
        pageCount: data.numpages,
        wordCount,
        hasStructure: true, // PDFs typically have structure
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error extracting PDF ${fileId}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Clean up extracted PDF text
 */
function cleanPdfText(text: string): string {
  return (
    text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Fix common PDF extraction issues:
      // - Words split across lines (hyphenation)
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // - Random line breaks within paragraphs
      .replace(/([a-z,])\n([a-z])/gi, '$1 $2')
      // Remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Remove page headers/footers (lines with just numbers)
      .replace(/^\s*\d+\s*$/gm, '')
      // Trim whitespace from each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Trim overall
      .trim()
  );
}

/**
 * Extract PDF with AI vision fallback
 *
 * First tries regular text extraction. If the PDF has no extractable text
 * (image-based PDF), falls back to AI vision analysis.
 *
 * @param fileId - Google Drive file ID
 * @param fileName - File name for AI context
 * @returns Extracted or AI-analyzed text
 */
export async function extractPdfWithVisionFallback(
  fileId: string,
  fileName: string
): Promise<ExtractionResult> {
  // First try regular extraction
  const result = await extractPdf(fileId);

  // If successful and has text, return it
  if (result.success && result.text.trim().length > 50) {
    return result;
  }

  // PDF has no extractable text - try AI vision
  console.log(`📄 PDF "${fileName}" has no text, trying AI vision analysis...`);

  try {
    // Download the PDF again for vision analysis
    const buffer = await downloadFile(fileId);

    // Check file size (20MB limit for vision API)
    const maxSizeBytes = 20 * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      return {
        success: false,
        text: '',
        error: `PDF too large for AI vision (${Math.round(buffer.length / 1024 / 1024)}MB). Max 20MB.`,
      };
    }

    // Analyze with AI vision
    const aiDescription = await analyzePdfWithVision(buffer, fileName);

    const wordCount = aiDescription
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      success: true,
      text: aiDescription,
      metadata: {
        wordCount,
        hasStructure: true,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ AI vision fallback failed for PDF ${fileName}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: `Text extraction empty and AI vision failed: ${errorMessage}`,
    };
  }
}
