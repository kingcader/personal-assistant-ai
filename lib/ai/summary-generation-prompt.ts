/**
 * Summary Generation Prompt
 *
 * AI prompt for generating concise document summaries.
 * Used during document processing to create searchable summaries.
 *
 * Part of Loop #5.5: RAG System Improvements
 */

export const SUMMARY_GENERATION_SYSTEM_PROMPT = `You are a document summarization assistant. Generate concise, informative summaries that help users quickly understand document contents.

## Rules

1. Keep summaries to 2-3 sentences maximum
2. Focus on: document type, main topics, key information
3. Be specific - include names, dates, numbers when relevant
4. Use active voice and clear language
5. Do not start with "This document" - be more direct

## Examples

Document content about a pricing agreement:
"Defines pricing tiers for the premium subscription: $99/month or $999/year with a 30-day money-back guarantee. Includes enterprise custom pricing and volume discounts for 10+ seats."

Document content about meeting notes:
"Q4 2024 planning meeting with marketing team. Decisions: Launch campaign delayed to January, budget increased to $50K, hired two new designers."

Document content about a legal contract:
"Service agreement between Acme Corp and Beta Inc for software development services. 12-month term starting January 2025, $150K total value with milestone-based payments."`;

/**
 * Build the prompt for summary generation
 */
export function buildSummaryPrompt(
  documentContent: string,
  fileName: string,
  mimeType: string
): string {
  // Truncate content if too long (use first ~2000 chars for summary)
  const truncatedContent =
    documentContent.length > 3000
      ? documentContent.substring(0, 3000) + '\n\n[Content truncated for summary generation]'
      : documentContent;

  const fileType = getFileTypeDescription(mimeType);

  return `Generate a 2-3 sentence summary for this ${fileType}.

File name: ${fileName}

Content:
"""
${truncatedContent}
"""

Summary:`;
}

/**
 * Get human-readable file type from MIME type
 */
function getFileTypeDescription(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/pdf': 'PDF document',
    'text/plain': 'text file',
    'text/markdown': 'markdown file',
    'text/csv': 'CSV spreadsheet',
    'text/html': 'web page',
    'image/jpeg': 'image',
    'image/png': 'image',
  };

  return typeMap[mimeType] || 'document';
}

/**
 * Generate a summary using AI
 */
export async function generateDocumentSummary(
  documentContent: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'openai';
  const userPrompt = buildSummaryPrompt(documentContent, fileName, mimeType);

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        system: SUMMARY_GENERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text?.trim() || '';
  } else {
    // OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SUMMARY_GENERATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '';
  }
}
