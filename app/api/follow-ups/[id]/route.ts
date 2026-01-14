/**
 * Follow-up Management API
 *
 * Handles approval, rejection, and status updates for follow-up suggestions.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * Usage:
 * - PATCH /api/follow-ups/:id - Update follow-up (approve/reject)
 * - GET /api/follow-ups/:id - Get follow-up details
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFollowUpById,
  approveFollowUp,
  rejectFollowUp,
} from '@/lib/supabase/thread-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get follow-up details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: followUpId } = await params;

    if (!followUpId) {
      return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 });
    }

    const followUp = await getFollowUpById(followUpId);

    if (!followUp) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    return NextResponse.json(followUp);
  } catch (error) {
    console.error('Error fetching follow-up:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Update follow-up (approve/reject)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: followUpId } = await params;

    if (!followUpId) {
      return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { action, edits, reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    let result;

    if (action === 'approve') {
      console.log(`✅ Approving follow-up: ${followUpId}`);
      result = await approveFollowUp(followUpId, edits);
    } else {
      console.log(`❌ Rejecting follow-up: ${followUpId}`);
      result = await rejectFollowUp(followUpId, reason);
    }

    return NextResponse.json({
      success: true,
      followUp: result,
    });
  } catch (error) {
    console.error('Error updating follow-up:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
