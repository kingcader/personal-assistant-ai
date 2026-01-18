/**
 * Knowledge Base Document API
 *
 * GET: Get document details with categories
 * DELETE: Delete a document
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentById,
  getDocumentCategories,
  deleteDocument,
} from '@/lib/supabase/kb-queries';
import { getDriveFileUrl } from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const document = await getDocumentById(id);

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const categories = await getDocumentCategories(id);

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        driveUrl: document.drive_file_id ? getDriveFileUrl(document.drive_file_id) : null,
        categories,
      },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
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
    const { id } = await params;

    // Check if document exists
    const document = await getDocumentById(id);
    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    await deleteDocument(id);

    return NextResponse.json({
      success: true,
      message: 'Document deleted',
      deletedDocument: {
        id: document.id,
        fileName: document.file_name,
      },
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
