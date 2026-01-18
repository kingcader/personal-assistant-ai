/**
 * Knowledge Base Individual Folder API
 *
 * Manage a specific synced folder.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage:
 * - GET /api/kb/folders/[id] - Get folder details with documents
 * - PATCH /api/kb/folders/[id] - Update folder settings
 * - DELETE /api/kb/folders/[id] - Remove folder from sync
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFolderById,
  updateFolder,
  deleteFolder,
  getDocumentsInFolder,
  TruthPriority,
} from '@/lib/supabase/kb-queries';
import { getDriveFolderUrl, getDriveFileUrl } from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/folders/[id]
 * Get folder details with documents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const folder = await getFolderById(id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Get documents in this folder
    const documents = await getDocumentsInFolder(id);

    // Add Drive URLs
    const documentsWithUrls = documents.map((doc) => ({
      ...doc,
      driveUrl: getDriveFileUrl(doc.drive_file_id),
    }));

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        driveUrl: getDriveFolderUrl(folder.drive_folder_id),
      },
      documents: documentsWithUrls,
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/kb/folders/[id]
 * Update folder settings
 *
 * Body: {
 *   folder_name?: string,
 *   truth_priority?: 'standard' | 'high' | 'authoritative',
 *   sync_enabled?: boolean
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate folder exists
    const folder = await getFolderById(id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Build updates object
    const updates: Partial<{
      folder_name: string;
      truth_priority: TruthPriority;
      sync_enabled: boolean;
    }> = {};

    if (body.folder_name !== undefined) {
      if (typeof body.folder_name !== 'string' || body.folder_name.trim() === '') {
        return NextResponse.json(
          { error: 'folder_name must be a non-empty string' },
          { status: 400 }
        );
      }
      updates.folder_name = body.folder_name.trim();
    }

    if (body.truth_priority !== undefined) {
      const validPriorities = ['standard', 'high', 'authoritative'];
      if (!validPriorities.includes(body.truth_priority)) {
        return NextResponse.json(
          { error: `truth_priority must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
      updates.truth_priority = body.truth_priority;
    }

    if (body.sync_enabled !== undefined) {
      if (typeof body.sync_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'sync_enabled must be a boolean' },
          { status: 400 }
        );
      }
      updates.sync_enabled = body.sync_enabled;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    const updatedFolder = await updateFolder(id, updates);

    return NextResponse.json({
      success: true,
      folder: {
        ...updatedFolder,
        driveUrl: getDriveFolderUrl(updatedFolder.drive_folder_id),
      },
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kb/folders/[id]
 * Remove folder from sync (deletes all associated documents and chunks)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate folder exists
    const folder = await getFolderById(id);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Delete folder (cascades to documents and chunks)
    await deleteFolder(id);

    console.log(`🗑️ Deleted folder: ${folder.folder_name}`);

    return NextResponse.json({
      success: true,
      message: `Folder "${folder.folder_name}" has been removed from sync`,
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
