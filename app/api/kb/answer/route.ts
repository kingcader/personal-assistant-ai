/**
 * Knowledge Base Answer API
 *
 * Synthesizes answers from knowledge base chunks using AI.
 * Returns grounded answers with citations.
 *
 * Part of Loop #5.5: RAG System Improvements
 *
 * Usage: POST /api/kb/answer
 * Body: { query: string, limit?: number, threshold?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedSearchQuery } from '@/lib/kb/embeddings';
import { searchChunks, logSearchQuery, TruthPriority } from '@/lib/supabase/kb-queries';
import { getDriveFileUrl } from '@/lib/google/drive';
import {
  ANSWER_GENERATION_SYSTEM_PROMPT,
  buildAnswerPrompt,
  parseAnswerResponse,
} from '@/lib/ai/answer-generation-prompt';

export const dynamic = 'force-dynamic';

/**
 * Citation returned with the answer
 */
interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

/**
 * Response structure for answer endpoint
 */
interface AnswerApiResponse {
  success: boolean;
  query: string;
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  chunksUsed: number;
  totalChunksSearched: number;
  keyPoints: string[];
  gaps: string[];
  searchDurationMs: number;
  answerDurationMs: number;
  error?: string;
}

/**
 * Call AI to generate answer
 */
async function generateAnswer(
  query: string,
  chunks: Array<{
    content: string;
    fileName: string;
    sectionTitle: string | null;
    similarity: number;
    truthPriority: string | null;
  }>
): Promise<{
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  keyPoints: string[];
  gaps: string[];
  sourcesUsed: number[];
}> {
  const provider = process.env.AI_PROVIDER || 'openai';

  const userPrompt = buildAnswerPrompt(query, chunks);

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: ANSWER_GENERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    return parseAnswerResponse(content);
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
          { role: 'system', content: ANSWER_GENERATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    return parseAnswerResponse(content);
  }
}

/**
 * POST /api/kb/answer
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate input
    const { query, limit = 8, threshold = 0.3, truthPriorityFilter } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Query must be at least 3 characters' },
        { status: 400 }
      );
    }

    console.log(`🤖 Generating answer for: "${query}"`);

    // Step 1: Search for relevant chunks
    const searchStartTime = Date.now();
    const queryEmbedding = await embedSearchQuery(query);

    const searchResults = await searchChunks({
      queryEmbedding,
      limit: Math.min(limit, 15), // Cap at 15 chunks for context
      threshold,
      truthPriorityFilter: truthPriorityFilter as TruthPriority | undefined,
    });

    const searchDuration = Date.now() - searchStartTime;
    console.log(`  📊 Found ${searchResults.length} chunks in ${searchDuration}ms`);

    // If no results, return early
    if (searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        answer:
          "I couldn't find any relevant information in the knowledge base to answer your question. Try rephrasing your query or ensure the relevant documents have been indexed.",
        citations: [],
        confidence: 'low',
        chunksUsed: 0,
        totalChunksSearched: 0,
        keyPoints: [],
        gaps: ['No matching documents found in knowledge base'],
        searchDurationMs: searchDuration,
        answerDurationMs: 0,
      } as AnswerApiResponse);
    }

    // Step 2: Prepare chunks for AI
    const chunksForAI = searchResults.map((result) => ({
      content: result.content,
      fileName: result.file_name,
      sectionTitle: result.section_title,
      similarity: result.similarity,
      truthPriority: result.truth_priority,
    }));

    // Step 3: Generate answer with AI
    const answerStartTime = Date.now();
    const aiResponse = await generateAnswer(query, chunksForAI);
    const answerDuration = Date.now() - answerStartTime;

    console.log(`  🧠 Generated answer in ${answerDuration}ms (confidence: ${aiResponse.confidence})`);

    // Step 4: Build citations from used sources
    const citations: Citation[] = aiResponse.sourcesUsed
      .filter((idx) => idx >= 0 && idx < searchResults.length)
      .map((idx) => {
        const result = searchResults[idx];
        return {
          fileName: result.file_name,
          sectionTitle: result.section_title,
          driveUrl: result.drive_file_id ? getDriveFileUrl(result.drive_file_id) : '',
          sourceUrl: null, // For website-sourced docs
          excerpt: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
          similarity: result.similarity,
          truthPriority: result.truth_priority,
        };
      });

    // If AI didn't specify sources, include all searched chunks as potential citations
    if (citations.length === 0 && searchResults.length > 0) {
      searchResults.slice(0, 5).forEach((result) => {
        citations.push({
          fileName: result.file_name,
          sectionTitle: result.section_title,
          driveUrl: result.drive_file_id ? getDriveFileUrl(result.drive_file_id) : '',
          sourceUrl: null,
          excerpt: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
          similarity: result.similarity,
          truthPriority: result.truth_priority,
        });
      });
    }

    // Step 5: Log search for analytics
    await logSearchQuery({
      query,
      queryEmbedding,
      resultCount: searchResults.length,
      topChunkIds: searchResults.slice(0, 5).map((r) => r.id),
      searchDurationMs: searchDuration,
      contextType: 'answer',
    });

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Answer complete in ${totalDuration}ms`);

    return NextResponse.json({
      success: true,
      query,
      answer: aiResponse.answer,
      citations,
      confidence: aiResponse.confidence,
      chunksUsed: citations.length,
      totalChunksSearched: searchResults.length,
      keyPoints: aiResponse.keyPoints,
      gaps: aiResponse.gaps,
      searchDurationMs: searchDuration,
      answerDurationMs: answerDuration,
    } as AnswerApiResponse);
  } catch (error) {
    console.error('❌ Answer generation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
