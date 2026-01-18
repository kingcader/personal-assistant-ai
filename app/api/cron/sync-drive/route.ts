/**
 * Drive Sync Cron Job
 *
 * Syncs files from configured Google Drive folders to the Knowledge Base.
 * Runs every 30 minutes to detect new and modified files.
 * Uses pagination to avoid timeout - processes 50 files per folder per run.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage: GET /api/cron/sync-drive
 *
 * Environment:
 * - Requires Google OAuth with drive scope
 * - CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listFilesInFolder,
  isSupportedMimeType,
  getFilePath,
} from '@/lib/google/drive';
import {
  getEnabledFolders,
  getDocumentByDriveId,
  upsertDocument,
  updateFolderSyncStatus,
  KBFolder,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

// Maximum files to process per folder per sync run
const MAX_FILES_PER_SYNC = 50;

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

    // 3. Sync each folder (limited number of files per run)
    for (const folder of folders) {
      try {
        const folderResult = await syncFolderBatch(folder);

        results.folders_synced++;
        results.files_discovered += folderResult.discovered;
        results.files_new += folderResult.new;
        results.files_updated += folderResult.updated;
        results.files_skipped += folderResult.skipped;

        // Update folder sync status
        await updateFolderSyncStatus(folder.id, {
          last_sync_at: new Date().toISOString(),
          last_sync_error: null,
          file_count: folder.file_count + folderResult.new,
        });

        console.log(
          `✅ Synced folder "${folder.folder_name}": ${folderResult.new} new, ${folderResult.updated} updated`
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
 * Sync files from a folder recursively with batching.
 * Processes up to MAX_FILES_PER_SYNC files total across all subfolders.
 */
async function syncFolderBatch(folder: KBFolder): Promise<{
  discovered: number;
  new: number;
  updated: number;
  skipped: number;
}> {
  const result = {
    discovered: 0,
    new: 0,
    updated: 0,
    skipped: 0,
  };

  // Queue of folder IDs to process (starts with root folder)
  const folderQueue: string[] = [folder.drive_folder_id];
  let filesProcessed = 0;

  while (folderQueue.length > 0 && filesProcessed < MAX_FILES_PER_SYNC) {
    const currentFolderId = folderQueue.shift()!;
    console.log(`📂 Processing folder: ${currentFolderId}...`);

    // List files in the current folder
    const pageResult = await listFilesInFolder(currentFolderId, undefined, 100);
    result.discovered += pageResult.files.length;

    for (const file of pageResult.files) {
      if (filesProcessed >= MAX_FILES_PER_SYNC) {
        console.log(`⏸️ Reached batch limit of ${MAX_FILES_PER_SYNC} files`);
        break;
      }

      // If it's a subfolder, add to queue for later processing
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folderQueue.push(file.id);
        console.log(`📁 Queued subfolder: ${file.name}`);
        continue;
      }

      // Check if file is supported
      if (!isSupportedMimeType(file.mimeType)) {
        result.skipped++;
        console.log(`⏭️ Skipped unsupported: ${file.name} (${file.mimeType})`);
        continue;
      }

      filesProcessed++;

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
  }

  console.log(`📊 Processed ${filesProcessed} files, ${folderQueue.length} folders remaining in queue`);
  return result;
}

/**
 * POST endpoint for manual sync trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
