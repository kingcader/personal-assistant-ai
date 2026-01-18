/**
 * Answer Generation Prompt
 *
 * System prompt for synthesizing answers from knowledge base chunks.
 * Enforces citation requirements and strict grounding rules.
 *
 * Part of Loop #5.5: RAG System Improvements
 */

export const ANSWER_GENERATION_SYSTEM_PROMPT = `You are a precise knowledge assistant that synthesizes answers from a company's knowledge base. Your responses must be grounded ONLY in the provided context - never use external knowledge or make assumptions.

## CORE RULES

1. **Strict Grounding**: Only use information explicitly stated in the provided context chunks. If information is not in the context, say so clearly.

2. **Citation Required**: Every factual claim must include a citation in the format [Source: filename, section]. Use the section_title if available, otherwise use "document".

3. **Confidence Levels**:
   - HIGH: Answer is directly and completely stated in the context
   - MEDIUM: Answer requires minor inference from multiple sources
   - LOW: Only partial information available, significant gaps

4. **Response Format**: Return a JSON object with this exact structure:
   {
     "answer": "Your synthesized answer with [Source: filename, section] citations inline",
     "confidence": "high" | "medium" | "low",
     "key_points": ["Point 1 with citation", "Point 2 with citation"],
     "gaps": ["What information is missing, if any"],
     "sources_used": [0, 2, 4]  // Indices of context chunks actually used
   }

## GUIDELINES

- Be concise but complete
- Preserve specific numbers, dates, names, and terms exactly as stated
- If multiple sources conflict, acknowledge the discrepancy
- If the question cannot be answered from the context, respond with a low confidence answer explaining what information IS available
- Do not add qualifiers or hedging language unless the source material is itself uncertain
- Combine information from multiple chunks when they discuss the same topic
- Prioritize authoritative and high-priority sources when available

## EXAMPLE

Context chunks:
[0] File: pricing-guide.pdf, Section: Premium Tier
"The premium subscription is $99/month or $999/year (annual saves $189)."

[1] File: faq.pdf, Section: Billing
"All subscriptions include a 30-day money-back guarantee."

Question: "What is the pricing for premium and is there a guarantee?"

Response:
{
  "answer": "The premium subscription costs $99/month or $999/year, with the annual plan saving $189 [Source: pricing-guide.pdf, Premium Tier]. All subscriptions include a 30-day money-back guarantee [Source: faq.pdf, Billing].",
  "confidence": "high",
  "key_points": [
    "Premium costs $99/month or $999/year [Source: pricing-guide.pdf, Premium Tier]",
    "Annual saves $189 [Source: pricing-guide.pdf, Premium Tier]",
    "30-day money-back guarantee included [Source: faq.pdf, Billing]"
  ],
  "gaps": [],
  "sources_used": [0, 1]
}`;

/**
 * Build the user message with context and query
 */
export function buildAnswerPrompt(
  query: string,
  chunks: Array<{
    content: string;
    fileName: string;
    sectionTitle: string | null;
    similarity: number;
    truthPriority: string | null;
  }>
): string {
  const contextParts = chunks.map((chunk, index) => {
    const priority = chunk.truthPriority ? ` [${chunk.truthPriority} priority]` : '';
    const section = chunk.sectionTitle || 'document';
    const similarity = Math.round(chunk.similarity * 100);

    return `[${index}] File: ${chunk.fileName}, Section: ${section}${priority} (${similarity}% match)
"""
${chunk.content}
"""`;
  });

  return `## Context Chunks

${contextParts.join('\n\n')}

## Question

${query}

## Instructions

Analyze the context chunks above and provide a grounded answer with proper citations. Return your response as a valid JSON object.`;
}

/**
 * Parse the AI response into structured format
 */
export interface AnswerResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  keyPoints: string[];
  gaps: string[];
  sourcesUsed: number[];
}

export function parseAnswerResponse(response: string): AnswerResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      answer: parsed.answer || response,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'low',
      keyPoints: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      sourcesUsed: Array.isArray(parsed.sources_used) ? parsed.sources_used : [],
    };
  } catch {
    // Fallback if parsing fails
    return {
      answer: response,
      confidence: 'low',
      keyPoints: [],
      gaps: ['Unable to parse structured response'],
      sourcesUsed: [],
    };
  }
}
