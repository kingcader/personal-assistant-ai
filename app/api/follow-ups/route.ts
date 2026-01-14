/**
 * Follow-ups List API
 *
 * Lists follow-up suggestions with optional filtering.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * Usage: GET /api/follow-ups?status=pending
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingFollowUps } from '@/lib/supabase/thread-queries';

export const dynamic = 'force-dynamic';

/**
 * Get follow-ups list
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Currently only supports pending status
    // Future: Add support for other statuses
    if (status && status !== 'pending') {
      return NextResponse.json(
        { error: 'Currently only status=pending is supported' },
        { status: 400 }
      );
    }

    const followUps = await getPendingFollowUps();

    return NextResponse.json({
      followUps,
      count: followUps.length,
    });
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
