/**
 * Google Sheets Text Extractor
 *
 * Exports Google Sheets as CSV and formats for searchable text.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { exportGoogleSheetAsCSV } from '@/lib/google/drive';
import type { ExtractionResult } from './index';

/**
 * Extract text from a Google Sheet
 *
 * @param fileId - Google Drive file ID
 * @returns Extracted text with metadata
 */
export async function extractGoogleSheet(fileId: string): Promise<ExtractionResult> {
  try {
    // Export as CSV
    const csv = await exportGoogleSheetAsCSV(fileId);

    // Parse and format as searchable text
    const { text, rowCount, columnCount } = formatSheetAsText(csv);

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
        hasStructure: true, // Sheets always have structure
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error extracting Google Sheet ${fileId}:`, errorMessage);
    return {
      success: false,
      text: '',
      error: errorMessage,
    };
  }
}

/**
 * Format spreadsheet data as searchable text
 */
function formatSheetAsText(csv: string): {
  text: string;
  rowCount: number;
  columnCount: number;
} {
  const lines = csv.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    return { text: '', rowCount: 0, columnCount: 0 };
  }

  // Parse headers (first row)
  const headers = parseCSVLine(lines[0]);
  const columnCount = headers.length;

  // Format each data row
  const formattedRows: string[] = [];

  // Include headers as a summary line
  formattedRows.push(`Columns: ${headers.join(', ')}`);
  formattedRows.push(''); // Blank line

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every((v) => !v.trim())) continue; // Skip empty rows

    // Create "Column: Value" format for non-empty values
    const pairs = headers
      .map((header, index) => {
        const value = values[index]?.trim() || '';
        return value ? `${header}=${value}` : null;
      })
      .filter(Boolean);

    if (pairs.length > 0) {
      formattedRows.push(`Row ${i}: ${pairs.join(', ')}`);
    }
  }

  return {
    text: formattedRows.join('\n'),
    rowCount: lines.length - 1, // Exclude header
    columnCount,
  };
}

/**
 * Parse a single CSV line (handles quoted values with commas and newlines)
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote (doubled quotes inside quoted field)
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last field
  values.push(current.trim());
  return values;
}

/**
 * Alternative format: Create a more detailed representation
 * with each row as a separate "record"
 */
export function formatSheetAsRecords(csv: string): string {
  const lines = csv.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return '';

  const headers = parseCSVLine(lines[0]);
  const records: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every((v) => !v.trim())) continue;

    const recordLines = [`--- Record ${i} ---`];
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      if (value) {
        recordLines.push(`  ${header}: ${value}`);
      }
    });

    if (recordLines.length > 1) {
      records.push(recordLines.join('\n'));
    }
  }

  return records.join('\n\n');
}
