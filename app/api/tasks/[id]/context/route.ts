/**
 * Task Context API
 *
 * Find and link relevant KB documents to a task.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage:
 * - GET /api/tasks/[id]/context - Get linked documents for a task
 * - POST /api/tasks/[id]/context - Find and link relevant documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { embedSearchQuery } from '@/lib/kb/embeddings';
import {
  searchChunks,
  getDocumentsForTask,
  linkDocumentToTask,
  getDocumentById,
} from '@/lib/supabase/kb-queries';
import { getDriveFileUrl } from '@/lib/google/drive';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

// Minimum similarity threshold for auto-linking
const AUTO_LINK_THRESHOLD = 0.8;

/**
 * GET /api/tasks/[id]/context
 * Get documents linked to this task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify task exists
    const { data: task, error: taskError } = await (supabase as any)
      .from('tasks')
      .select('id, title, description')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get linked documents
    const linkedDocs = await getDocumentsForTask(id);

    // Format response
    const documents = linkedDocs.map((item) => ({
      id: item.document.id,
      fileName: item.document.file_name,
      filePath: item.document.file_path,
      relevanceScore: item.relevance_score,
      autoLinked: item.auto_linked,
      driveUrl: getDriveFileUrl(item.document.drive_file_id),
      status: item.document.status,
    }));

    return NextResponse.json({
      success: true,
      taskId: id,
      documents,
    });
  } catch (error) {
    console.error('Error fetching task context:', error);
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
 * POST /api/tasks/[id]/context
 * Find and link relevant documents to this task
 *
 * Body: {
 *   autoLink?: boolean  // Auto-link documents above threshold (default: true)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const autoLink = body.autoLink !== false;

    // Get task details
    const { data: task, error: taskError } = await (supabase as any)
      .from('tasks')
      .select('id, title, description')
      .eq('id', id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Create search query from task title and description
    const searchQuery = [task.title, task.description]
      .filter(Boolean)
      .join(' ');

    if (!searchQuery.trim()) {
      return NextResponse.json({
        success: true,
        message: 'Task has no content to search',
        suggestedDocuments: [],
        linkedCount: 0,
      });
    }

    console.log(`🔍 Finding context for task: ${task.title}`);

    // Generate embedding for the task
    const queryEmbedding = await embedSearchQuery(searchQuery);

    // Search for relevant chunks
    const searchResults = await searchChunks({
      queryEmbedding,
      limit: 20,
      threshold: 0.7,
    });

    // Group by document (a document may have multiple matching chunks)
    const documentScores = new Map<
      string,
      { maxSimilarity: number; fileName: string; driveFileId: string }
    >();

    for (const result of searchResults) {
      const existing = documentScores.get(result.document_id);
      if (!existing || result.similarity > existing.maxSimilarity) {
        documentScores.set(result.document_id, {
          maxSimilarity: result.similarity,
          fileName: result.file_name,
          driveFileId: result.drive_file_id,
        });
      }
    }

    // Sort by similarity
    const sortedDocs = Array.from(documentScores.entries())
      .map(([docId, data]) => ({
        documentId: docId,
        similarity: data.maxSimilarity,
        fileName: data.fileName,
        driveUrl: getDriveFileUrl(data.driveFileId),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Auto-link high-relevance documents
    let linkedCount = 0;
    if (autoLink) {
      for (const doc of sortedDocs) {
        if (doc.similarity >= AUTO_LINK_THRESHOLD) {
          await linkDocumentToTask({
            taskId: id,
            documentId: doc.documentId,
            relevanceScore: doc.similarity,
            autoLinked: true,
          });
          linkedCount++;
        }
      }
    }

    console.log(
      `✅ Found ${sortedDocs.length} relevant documents, auto-linked ${linkedCount}`
    );

    return NextResponse.json({
      success: true,
      taskId: id,
      suggestedDocuments: sortedDocs.slice(0, 10),
      linkedCount,
      message:
        linkedCount > 0
          ? `Auto-linked ${linkedCount} highly relevant document${linkedCount > 1 ? 's' : ''}`
          : 'No documents met the auto-link threshold',
    });
  } catch (error) {
    console.error('Error finding task context:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
