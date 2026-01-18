/**
 * Plain Text File Extractor
 *
 * Extracts text from plain text, markdown, CSV, and HTML files.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { downloadFileAsText } from '@/lib/google/drive';
import { SUPPORTED_MIME_TYPES } from '@/lib/google/drive';
import type { ExtractionResult } from './index';

/**
 * Extract text from a text-based file
 *
 * @param fileId - Google Drive file ID
 * @param mimeType - MIME type of the file
 * @returns Extracted text with metadata
 */
export async function extractTextFile(
  fileId: string,
  mimeType: string
): Promise<ExtractionResult> {
  try {
    // Download the file as text
    const rawText = await downloadFileAsText(fileId);

    // Process based on MIME type
    let text: string;
    let hasStructure = false;

    switch (mimeType) {
      case SUPPORTED_MIME_TYPES.TEXT_HTML:
        text = stripHtml(rawText);
        hasStructure = true;
        break;

      case SUPPORTED_MIME_TYPES.TEXT_MARKDOWN:
        text = cleanMarkdown(rawText);
        hasStructure = true;
        break;

      case SUPPORTED_MIME_TYPES.TEXT_CSV:
        text = formatCsvAsText(rawText);
        hasStructure = true;
        break;

      case SUPPORTED_MIME_TYPES.TEXT_PLAIN:
      default:
        text = cleanPlainText(rawText);
        hasStructure = detectStructure(text);
        break;
    }

    // Count words
    const wordCount = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      success: true,
      text,
      metadata: {
        wordCount,
        hasStructure,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error extracting text file ${fileId}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Strip HTML tags and extract text content
 */
function stripHtml(html: string): string {
  return (
    html
      // Remove scripts and style blocks
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Convert common block elements to newlines
      .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)\s*>/gi, '\n')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Clean up markdown text (keep it mostly as-is, it's readable)
 */
function cleanMarkdown(markdown: string): string {
  return (
    markdown
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Format CSV data as searchable text
 */
function formatCsvAsText(csv: string): string {
  const lines = csv.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return '';

  // Parse headers (first row)
  const headers = parseCSVLine(lines[0]);

  // Format each data row
  const formattedRows: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    // Create "Column: Value" format
    const pairs = headers
      .map((header, index) => {
        const value = values[index] || '';
        return value ? `${header}=${value}` : null;
      })
      .filter(Boolean);

    if (pairs.length > 0) {
      formattedRows.push(`Row ${i}: ${pairs.join(', ')}`);
    }
  }

  return formattedRows.join('\n');
}

/**
 * Parse a single CSV line (handles quoted values)
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Clean up plain text
 */
function cleanPlainText(text: string): string {
  return (
    text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace from each line
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim()
  );
}

/**
 * Detect if plain text has structure
 */
function detectStructure(text: string): boolean {
  // Check for markdown-style headings
  const hasMarkdownHeadings = /^#{1,6}\s+/m.test(text);

  // Check for ALL CAPS headings
  const hasAllCapsHeadings = /^[A-Z][A-Z\s]{5,}$/m.test(text);

  // Check for numbered lists
  const hasNumberedLists = /^\s*\d+[.)]\s+/m.test(text);

  // Check for bullet lists
  const hasBulletLists = /^\s*[-*•]\s+/m.test(text);

  return hasMarkdownHeadings || hasAllCapsHeadings || hasNumberedLists || hasBulletLists;
}
