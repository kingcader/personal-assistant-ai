/**
 * SOPs API
 *
 * CRUD operations for Standard Operating Procedures.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/sops - List all SOPs
 * POST /api/sops - Create a new SOP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSops,
  createSop,
  findSopsByTrigger,
  type SopCategory,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sops
 * List SOPs, optionally filtered by category or trigger
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as SopCategory | null;
    const trigger = searchParams.get('trigger');
    const includeInactive = searchParams.get('inactive') === 'true';

    let sops;

    if (trigger) {
      // Find SOPs by trigger pattern
      sops = await findSopsByTrigger(trigger);
    } else {
      sops = await getSops(category || undefined, !includeInactive);
    }

    return NextResponse.json({
      success: true,
      sops,
      count: sops.length,
    });
  } catch (error) {
    console.error('Error fetching SOPs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch SOPs',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sops
 * Create a new SOP
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.category || !body.steps) {
      return NextResponse.json(
        { success: false, error: 'name, category, and steps are required' },
        { status: 400 }
      );
    }

    const sop = await createSop({
      name: body.name,
      description: body.description,
      category: body.category,
      trigger_patterns: body.trigger_patterns,
      steps: body.steps,
      examples: body.examples,
      priority: body.priority,
    });

    return NextResponse.json({
      success: true,
      sop,
    });
  } catch (error) {
    console.error('Error creating SOP:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create SOP',
      },
      { status: 500 }
    );
  }
}
