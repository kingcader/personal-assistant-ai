/**
 * List Subfolders API
 *
 * Helper endpoint to list subfolders in a Google Drive folder.
 * Used to find folder IDs for adding to Knowledge Base.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listFilesInFolder, getDriveFolderUrl } from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentFolderId = searchParams.get('parentId');

    if (!parentFolderId) {
      return NextResponse.json(
        { error: 'parentId query parameter is required' },
        { status: 400 }
      );
    }

    // List items in the folder
    const result = await listFilesInFolder(parentFolderId, undefined, 100);

    // Filter to only folders
    const subfolders = result.files
      .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
      .map(f => ({
        id: f.id,
        name: f.name,
        driveUrl: getDriveFolderUrl(f.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      parentFolderId,
      subfolders,
      count: subfolders.length,
    });
  } catch (error) {
    console.error('Error listing subfolders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
