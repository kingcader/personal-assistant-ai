/**
 * SOP Detail API
 *
 * Operations on a specific SOP.
 * Part of Loop 9: Business Context + Agent Foundation
 *
 * GET /api/sops/[id] - Get SOP details
 * PATCH /api/sops/[id] - Update SOP
 * DELETE /api/sops/[id] - Delete SOP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSopById,
  updateSop,
  deleteSop,
  recordSopUsage,
} from '@/lib/supabase/business-context-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sops/[id]
 * Get SOP details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const sop = await getSopById(id);

    if (!sop) {
      return NextResponse.json(
        { success: false, error: 'SOP not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sop,
    });
  } catch (error) {
    console.error('Error fetching SOP:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch SOP',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sops/[id]
 * Update SOP
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Handle special action to record usage
    if (body.action === 'record_usage') {
      await recordSopUsage(id);
      const sop = await getSopById(id);
      return NextResponse.json({ success: true, sop });
    }

    // Remove fields that shouldn't be updated directly
    delete body.id;
    delete body.created_at;
    delete body.updated_at;
    delete body.times_used;
    delete body.last_used_at;

    const sop = await updateSop(id, body);

    return NextResponse.json({
      success: true,
      sop,
    });
  } catch (error) {
    console.error('Error updating SOP:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update SOP',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sops/[id]
 * Delete SOP
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await deleteSop(id);

    return NextResponse.json({
      success: true,
      message: 'SOP deleted',
    });
  } catch (error) {
    console.error('Error deleting SOP:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete SOP',
      },
      { status: 500 }
    );
  }
}
