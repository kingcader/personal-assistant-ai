/**
 * Knowledge Base Categories API
 *
 * GET: List all categories
 * POST: Create a new category
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllCategories, createCategory } from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await getAllCategories();
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    const category = await createCategory({
      name: name.trim(),
      description: description?.trim() || undefined,
      color: color || undefined,
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Error creating category:', error);

    // Check for unique constraint violation
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
