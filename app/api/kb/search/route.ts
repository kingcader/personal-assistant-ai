/**
 * Knowledge Base Search API
 *
 * Semantic search across indexed documents using vector similarity.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage: POST /api/kb/search
 * Body: { query: string, limit?: number, truthPriorityFilter?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedSearchQuery } from '@/lib/kb/embeddings';
import {
  searchChunks,
  logSearchQuery,
  TruthPriority,
} from '@/lib/supabase/kb-queries';
import { getDriveFileUrl } from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

/**
 * Search result returned to client
 */
interface SearchResultResponse {
  chunkId: string;
  content: string;
  documentPath: string | null;
  fileName: string;
  sectionTitle: string | null;
  similarity: number;
  truthPriority: string | null;
  driveUrl: string;
}

/**
 * POST /api/kb/search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const { query, limit = 10, truthPriorityFilter, threshold = 0.7 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Query must be at least 3 characters' },
        { status: 400 }
      );
    }

    console.log(`🔍 Searching KB: "${query}"`);
    const startTime = Date.now();

    // Generate embedding for the query
    const queryEmbedding = await embedSearchQuery(query);

    // Search for similar chunks
    const results = await searchChunks({
      queryEmbedding,
      limit: Math.min(limit, 50), // Cap at 50 results
      threshold,
      truthPriorityFilter: truthPriorityFilter as TruthPriority | undefined,
    });

    const searchDuration = Date.now() - startTime;

    // Transform results for response
    const responseResults: SearchResultResponse[] = results.map((result) => ({
      chunkId: result.id,
      content: result.content,
      documentPath: result.file_path,
      fileName: result.file_name,
      sectionTitle: result.section_title,
      similarity: result.similarity,
      truthPriority: result.truth_priority,
      driveUrl: getDriveFileUrl(result.drive_file_id),
    }));

    // Log the search query for analytics
    await logSearchQuery({
      query,
      queryEmbedding,
      resultCount: results.length,
      topChunkIds: results.slice(0, 5).map((r) => r.id),
      searchDurationMs: searchDuration,
    });

    console.log(`✅ Found ${results.length} results in ${searchDuration}ms`);

    return NextResponse.json({
      success: true,
      query,
      results: responseResults,
      totalResults: results.length,
      searchDurationMs: searchDuration,
    });
  } catch (error) {
    console.error('❌ Search failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kb/search?q=...
 * Convenience endpoint for simple searches
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = searchParams.get('limit');
  const truthPriority = searchParams.get('priority');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  // Create a mock request with the query
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({
      query,
      limit: limit ? parseInt(limit, 10) : 10,
      truthPriorityFilter: truthPriority,
    }),
  });

  return POST(mockRequest);
}
