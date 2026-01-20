/**
 * Business Rule Detail API
 *
 * Operations on a specific business rule.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/rules/[id] - Get rule details
 * PATCH /api/rules/[id] - Update rule
 * DELETE /api/rules/[id] - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessRuleById,
  updateBusinessRule,
  deleteBusinessRule,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/rules/[id]
 * Get business rule details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const rule = await getBusinessRuleById(id);

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Business rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Error fetching business rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rule',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rules/[id]
 * Update business rule
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    delete body.id;
    delete body.created_at;
    delete body.updated_at;
    delete body.times_applied;
    delete body.last_applied_at;

    const rule = await updateBusinessRule(id, body);

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Error updating business rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update rule',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rules/[id]
 * Delete business rule
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await deleteBusinessRule(id);

    return NextResponse.json({
      success: true,
      message: 'Business rule deleted',
    });
  } catch (error) {
    console.error('Error deleting business rule:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete rule',
      },
      { status: 500 }
    );
  }
}
