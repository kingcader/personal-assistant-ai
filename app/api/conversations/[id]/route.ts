/**
 * Single Conversation API Endpoint
 *
 * GET /api/conversations/[id] - Get conversation with messages
 * PATCH /api/conversations/[id] - Update conversation (title, archive status)
 * DELETE /api/conversations/[id] - Delete conversation
 *
 * Part of Loop #7 Enhancements: Conversation Persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getConversationWithMessages,
  updateConversationTitle,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
} from '@/lib/supabase/conversation-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]
 * Get a conversation with all its messages
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await getConversationWithMessages(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation: result.conversation,
      messages: result.messages,
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
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
 * PATCH /api/conversations/[id]
 * Update conversation title or archive status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, is_archived } = body;

    let conversation;

    // Handle title update
    if (title !== undefined) {
      conversation = await updateConversationTitle(id, title);
    }

    // Handle archive/unarchive
    if (is_archived !== undefined) {
      if (is_archived) {
        conversation = await archiveConversation(id);
      } else {
        conversation = await unarchiveConversation(id);
      }
    }

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
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
 * DELETE /api/conversations/[id]
 * Delete a conversation and all its messages
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await deleteConversation(id);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
