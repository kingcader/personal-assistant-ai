/**
 * Business Rules API
 *
 * CRUD operations for business rules.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/rules - List all rules
 * POST /api/rules - Create a new rule
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessRules,
  createBusinessRule,
  getApplicableRules,
  type SopCategory,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rules
 * List business rules, optionally filtered
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('inactive') === 'true';
    const projectId = searchParams.get('project_id');
    const entityId = searchParams.get('entity_id');
    const category = searchParams.get('category') as SopCategory | null;

    let rules;

    // If filtering by context, use getApplicableRules
    if (projectId || entityId || category) {
      rules = await getApplicableRules({
        projectId: projectId || undefined,
        entityId: entityId || undefined,
        category: category || undefined,
      });
    } else {
      rules = await getBusinessRules(!includeInactive);
    }

    return NextResponse.json({
      success: true,
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Error fetching business rules:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rules',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rules
 * Create a new business rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.rule_type || !body.condition || !body.action) {
      return NextResponse.json(
        { success: false, error: 'name, rule_type, condition, and action are required' },
        { status: 400 }
      );
    }

    const rule = await createBusinessRule({
      name: body.name,
      description: body.description,
      rule_type: body.rule_type,
      condition: body.condition,
      action: body.action,
      applies_to_projects: body.applies_to_projects,
      applies_to_entities: body.applies_to_entities,
      applies_to_categories: body.applies_to_categories,
      priority: body.priority,
    });

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Error creating business rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create rule',
      },
      { status: 500 }
    );
  }
}
