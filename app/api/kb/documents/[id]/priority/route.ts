/**
 * Document Priority API
 *
 * Update processing priority for a document.
 *
 * Part of Loop #5.5: Document Priority UI
 *
 * Usage: PATCH /api/kb/documents/[id]/priority
 * Body: { priority: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentById,
  updateDocumentPriority,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/kb/documents/[id]/priority - Update document priority
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Priority levels: Normal=0, High=5, Urgent=10
  const PRIORITY_HIGH = 5;
  const PRIORITY_URGENT = 10;

  try {
    const { id } = await params;
    const body = await request.json();
    const { priority } = body;

    // Validate priority
    if (priority === undefined || typeof priority !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Priority must be a number' },
        { status: 400 }
      );
    }

    if (priority < 0 || priority > 10) {
      return NextResponse.json(
        { success: false, error: 'Priority must be between 0 and 10' },
        { status: 400 }
      );
    }

    // Check document exists
    const document = await getDocumentById(id);
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Update priority
    await updateDocumentPriority(id, priority);

    // Determine priority label for response
    let priorityLabel = 'Normal';
    if (priority >= PRIORITY_URGENT) {
      priorityLabel = 'Urgent';
    } else if (priority >= PRIORITY_HIGH) {
      priorityLabel = 'High';
    }

    return NextResponse.json({
      success: true,
      documentId: id,
      priority,
      priorityLabel,
      message: `Priority set to ${priorityLabel}`,
    });
  } catch (error) {
    console.error('Error updating document priority:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
