/**
 * Decisions API
 *
 * CRUD operations for decision log.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/decisions - List decisions
 * POST /api/decisions - Log a new decision
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDecisions,
  logDecision,
  searchDecisions,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/decisions
 * List decisions, optionally filtered by project or search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const query = searchParams.get('q');
    const includeSuperseded = searchParams.get('superseded') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let decisions;

    if (query) {
      // Search decisions
      decisions = await searchDecisions(query, limit);
    } else {
      decisions = await getDecisions({
        projectId: projectId || undefined,
        currentOnly: !includeSuperseded,
        limit,
      });
    }

    return NextResponse.json({
      success: true,
      decisions,
      count: decisions.length,
    });
  } catch (error) {
    console.error('Error fetching decisions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch decisions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/decisions
 * Log a new decision
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.decision) {
      return NextResponse.json(
        { success: false, error: 'decision text is required' },
        { status: 400 }
      );
    }

    const decision = await logDecision({
      decision: body.decision,
      rationale: body.rationale,
      context: body.context,
      decided_at: body.decided_at,
      project_id: body.project_id,
      related_entity_ids: body.related_entity_ids,
      related_task_ids: body.related_task_ids,
      source: body.source || 'manual',
      source_reference: body.source_reference,
      supersedes_id: body.supersedes_id,
    });

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error('Error logging decision:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log decision',
      },
      { status: 500 }
    );
  }
}
