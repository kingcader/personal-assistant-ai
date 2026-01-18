/**
 * Knowledge Base Category API
 *
 * GET: Get a single category
 * PUT: Update a category
 * DELETE: Delete a category
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const category = await getCategoryById(id);

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color } = body;

    // Check if category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Build updates object
    const updates: { name?: string; description?: string; color?: string } = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (color !== undefined) updates.color = color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    const category = await updateCategory(id, updates);
    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Error updating category:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
      return NextResponse.json(
        { success: false, error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    await deleteCategory(id);
    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
