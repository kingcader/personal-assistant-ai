/**
 * PDF Text Extractor
 *
 * Extracts text from PDF files using pdf-parse.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { downloadFile } from '@/lib/google/drive';
import type { ExtractionResult } from './index';

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
