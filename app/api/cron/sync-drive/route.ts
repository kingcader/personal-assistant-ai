/**
 * Drive Sync Cron Job
 *
 * Syncs files from configured Google Drive folders to the Knowledge Base.
 * Runs every 30 minutes to detect new and modified files.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage: GET /api/cron/sync-drive
 *
 * Environment:
 * - Requires Google OAuth with drive.readonly scope
 * - CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listAllFilesInFolder,
  isSupportedMimeType,
  getFolderMetadata,
  getFilePath,
  DriveFile,
} from '@/lib/google/drive';
import {
  getEnabledFolders,
  getDocumentByDriveId,
  upsertDocument,
  updateFolderSyncStatus,
  getDocumentsInFolder,
  markDocumentsDeleted,
  KBFolder,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

/**
 * Main Drive sync handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📁 Starting Drive sync...');

    const results = {
      folders_synced: 0,
      files_discovered: 0,
      files_new: 0,
      files_updated: 0,
      files_deleted: 0,
      files_skipped: 0,
      errors: [] as string[],
    };

    // 2. Get all enabled folders
    const folders = await getEnabledFolders();
    console.log(`📂 Found ${folders.length} enabled folders to sync`);

    if (folders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No folders configured for sync',
        ...results,
      });
    }

    // 3. Sync each folder
    for (const folder of folders) {
      try {
        const folderResult = await syncFolder(folder);

        results.folders_synced++;
        results.files_discovered += folderResult.discovered;
        results.files_new += folderResult.new;
        results.files_updated += folderResult.updated;
        results.files_deleted += folderResult.deleted;
        results.files_skipped += folderResult.skipped;

        // Update folder sync status
        await updateFolderSyncStatus(folder.id, {
          last_sync_at: new Date().toISOString(),
          last_sync_error: null,
          file_count: folderResult.discovered,
        });

        console.log(
          `✅ Synced folder "${folder.folder_name}": ${folderResult.new} new, ${folderResult.updated} updated, ${folderResult.deleted} deleted`
        );
      } catch (error) {
        const errorMsg = `Failed to sync folder "${folder.folder_name}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);

        // Update folder with error
        await updateFolderSyncStatus(folder.id, {
          last_sync_error: errorMsg,
        });
      }
    }

    console.log('✅ Drive sync complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Fatal error in Drive sync:', error);
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
 * Sync a single folder
 */
async function syncFolder(folder: KBFolder): Promise<{
  discovered: number;
  new: number;
  updated: number;
  deleted: number;
  skipped: number;
}> {
  const result = {
    discovered: 0,
    new: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  };

  // List all files in the Drive folder
  console.log(`📂 Listing files in "${folder.folder_name}" (${folder.drive_folder_id})...`);
  const driveFiles = await listAllFilesInFolder(folder.drive_folder_id, false, true);

  result.discovered = driveFiles.length;
  console.log(`📄 Found ${driveFiles.length} supported files`);

  // Track which Drive file IDs we've seen
  const seenDriveIds = new Set<string>();

  // Process each file
  for (const file of driveFiles) {
    seenDriveIds.add(file.id);

    // Check if file is supported
    if (!isSupportedMimeType(file.mimeType)) {
      result.skipped++;
      continue;
    }

    // Check if document already exists
    const existingDoc = await getDocumentByDriveId(file.id);

    if (!existingDoc) {
      // New file - create document
      await upsertDocument({
        folder_id: folder.id,
        drive_file_id: file.id,
        file_name: file.name,
        file_path: await getFilePath(file.id),
        mime_type: file.mimeType,
        drive_modified_at: file.modifiedTime.toISOString(),
        file_size_bytes: file.size || undefined,
        truth_priority: folder.truth_priority,
      });
      result.new++;
      console.log(`📄 New file: ${file.name}`);
    } else {
      // Check if file has been modified
      const existingModified = existingDoc.drive_modified_at
        ? new Date(existingDoc.drive_modified_at)
        : null;

      if (!existingModified || file.modifiedTime > existingModified) {
        // File has been updated - mark for reprocessing
        await upsertDocument({
          folder_id: folder.id,
          drive_file_id: file.id,
          file_name: file.name,
          file_path: await getFilePath(file.id),
          mime_type: file.mimeType,
          drive_modified_at: file.modifiedTime.toISOString(),
          file_size_bytes: file.size || undefined,
          truth_priority: folder.truth_priority,
        });
        result.updated++;
        console.log(`📝 Updated file: ${file.name}`);
      }
    }
  }

  // Check for deleted files (files in DB but no longer in Drive)
  const existingDocs = await getDocumentsInFolder(folder.id);
  const deletedDriveIds: string[] = [];

  for (const doc of existingDocs) {
    if (!seenDriveIds.has(doc.drive_file_id) && doc.status !== 'deleted') {
      deletedDriveIds.push(doc.drive_file_id);
    }
  }

  if (deletedDriveIds.length > 0) {
    await markDocumentsDeleted(deletedDriveIds);
    result.deleted = deletedDriveIds.length;
    console.log(`🗑️ Marked ${deletedDriveIds.length} files as deleted`);
  }

  return result;
}

/**
 * POST endpoint for manual sync trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
