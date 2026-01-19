/**
 * Conversations API Endpoint
 *
 * GET /api/conversations - List conversations
 * POST /api/conversations - Create new conversation
 *
 * Part of Loop #7 Enhancements: Conversation Persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listConversations,
  createConversation,
  searchConversations,
} from '@/lib/supabase/conversation-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * List conversations with optional search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let conversations;

    if (search) {
      // Search conversations by title or message content
      conversations = await searchConversations(search, limit);
    } else {
      // List recent conversations
      conversations = await listConversations(limit, offset, includeArchived);
    }

    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
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
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body;

    const conversation = await createConversation(title);

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
