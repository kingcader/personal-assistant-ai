/**
 * Project Activity API
 *
 * Manage activity log for a project.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/projects/[id]/activity - Get project activity
 * POST /api/projects/[id]/activity - Add activity entry
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectActivity,
  addProjectActivity,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/activity
 * Get project activity log
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const activity = await getProjectActivity(id, limit);

    return NextResponse.json({
      success: true,
      activity,
      count: activity.length,
    });
  } catch (error) {
    console.error('Error fetching project activity:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activity',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/activity
 * Add activity entry
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.activity_type || !body.description) {
      return NextResponse.json(
        { success: false, error: 'activity_type and description are required' },
        { status: 400 }
      );
    }

    const activity = await addProjectActivity({
      project_id: id,
      activity_type: body.activity_type,
      description: body.description,
      source_type: body.source_type,
      source_id: body.source_id,
      entity_ids: body.entity_ids,
      occurred_at: body.occurred_at,
    });

    return NextResponse.json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error('Error adding project activity:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add activity',
      },
      { status: 500 }
    );
  }
}
