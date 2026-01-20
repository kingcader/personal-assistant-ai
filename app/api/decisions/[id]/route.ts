/**
 * Decision Detail API
 *
 * Operations on a specific decision.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/decisions/[id] - Get decision details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDecisionById } from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/decisions/[id]
 * Get decision details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const decision = await getDecisionById(id);

    if (!decision) {
      return NextResponse.json(
        { success: false, error: 'Decision not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error('Error fetching decision:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch decision',
      },
      { status: 500 }
    );
  }
}
