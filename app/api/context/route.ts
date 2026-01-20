/**
 * Business Context API
 *
 * Returns full business context for agent use.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/context - Get full business context (projects, SOPs, rules, decisions)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFullBusinessContext,
  getProjectContext,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/context
 * Get full business context for agent use
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (projectId) {
      // Get context for a specific project
      const context = await getProjectContext(projectId);

      if (!context.project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        context,
      });
    }

    // Get full business context
    const context = await getFullBusinessContext();

    return NextResponse.json({
      success: true,
      context,
      summary: {
        active_projects: context.projects.length,
        active_sops: context.sops.length,
        active_rules: context.rules.length,
        recent_decisions: context.recentDecisions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching business context:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch context',
      },
      { status: 500 }
    );
  }
}
