/**
 * Projects API
 *
 * CRUD operations for projects/deals.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/projects - List all projects
 * POST /api/projects - Create a new project
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getProjects,
  createProject,
  type ProjectStatus,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * List all projects, optionally filtered by status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ProjectStatus | null;

    const projects = await getProjects(status || undefined);

    return NextResponse.json({
      success: true,
      projects,
      count: projects.length,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    const project = await createProject({
      name: body.name,
      description: body.description,
      status: body.status,
      entity_id: body.entity_id,
      key_contacts: body.key_contacts,
      milestones: body.milestones,
      current_blockers: body.current_blockers,
      next_steps: body.next_steps,
      started_at: body.started_at,
      target_completion: body.target_completion,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      },
      { status: 500 }
    );
  }
}
