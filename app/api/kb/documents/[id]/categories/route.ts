/**
 * Document Categories API
 *
 * GET: Get categories for a document
 * POST: Assign a category to a document
 * DELETE: Remove a category from a document
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentById,
  getCategoryById,
  getDocumentCategories,
  assignCategoryToDocument,
  removeCategoryFromDocument,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if document exists
    const document = await getDocumentById(id);
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const categories = await getDocumentCategories(id);
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching document categories:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const body = await request.json();
    const { categoryId } = body;

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId is required' },
        { status: 400 }
      );
    }

    // Check if document exists
    const document = await getDocumentById(documentId);
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if category exists
    const category = await getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    await assignCategoryToDocument(documentId, categoryId);

    // Return updated categories list
    const categories = await getDocumentCategories(documentId);

    return NextResponse.json({
      success: true,
      message: `Category "${category.name}" assigned to document`,
      categories,
    });
  } catch (error) {
    console.error('Error assigning category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: documentId } = await params;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId query parameter is required' },
        { status: 400 }
      );
    }

    // Check if document exists
    const document = await getDocumentById(documentId);
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    await removeCategoryFromDocument(documentId, categoryId);

    // Return updated categories list
    const categories = await getDocumentCategories(documentId);

    return NextResponse.json({
      success: true,
      message: 'Category removed from document',
      categories,
    });
  } catch (error) {
    console.error('Error removing category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
