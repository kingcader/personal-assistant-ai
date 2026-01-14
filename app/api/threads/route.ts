/**
 * Threads API
 *
 * Lists threads with waiting-on status.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * Usage: GET /api/threads?waiting=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWaitingOnThreads } from '@/lib/supabase/thread-queries';

export const dynamic = 'force-dynamic';

/**
 * Get threads list
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const waitingOnly = searchParams.get('waiting') === 'true';

    if (waitingOnly) {
      const threads = await getWaitingOnThreads();
      return NextResponse.json({
        threads,
        count: threads.length,
      });
    }

    // Future: Support listing all threads
    return NextResponse.json(
      { error: 'Currently only waiting=true is supported' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
