/**
 * Drive Sync Cron Job
 *
 * Syncs files from configured Google Drive folders to the Knowledge Base.
 * Runs every 30 minutes to detect new and modified files.
 * Processes ONE folder per run to stay within cron-job.org's 30s timeout.
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
} from '@/lib/google/drive';
import {
  getEnabledFolders,
  getDocumentByDriveId,
  upsertDocument,
  updateFolderSyncStatus,
  KBFolder,
} from '@/lib/supabase/kb-queries';

export const dynamic = 'force-dynamic';

// Process up to 3 folders per cron run (30s timeout)
const FOLDERS_PER_RUN = 3;

// Maximum files to process per folder per sync run
const MAX_FILES_PER_SYNC = 20;

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

    // 2. Get all enabled folders, sorted by last_sync_at (oldest first for round-robin)
    const allFolders = await getEnabledFolders();

    if (allFolders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No folders configured for sync',
        ...results,
      });
    }

    // Sort by last_sync_at (null first, then oldest)
    const sortedFolders = allFolders.sort((a, b) => {
      if (!a.last_sync_at && !b.last_sync_at) return 0;
      if (!a.last_sync_at) return -1;
      if (!b.last_sync_at) return 1;
      return new Date(a.last_sync_at).getTime() - new Date(b.last_sync_at).getTime();
    });

    // Take only FOLDERS_PER_RUN folders
    const folders = sortedFolders.slice(0, FOLDERS_PER_RUN);
    console.log(`📂 Processing ${folders.length} of ${allFolders.length} folders (oldest first)`);

    // 3. Sync the selected folder(s)
    for (const folder of folders) {
      try {
        console.log(`📁 Syncing: ${folder.folder_name}`);
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
          `✅ Synced "${folder.folder_name}": ${folderResult.new} new, ${folderResult.updated} updated`
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

    // List files in the current folder (limit to 50 to reduce API response size)
    const pageResult = await listFilesInFolder(currentFolderId, undefined, 50);
    result.discovered += pageResult.files.length;

    for (const file of pageResult.files) {
      if (filesProcessed >= MAX_FILES_PER_SYNC) {
        break;
      }

      // If it's a subfolder, add to queue for later processing
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folderQueue.push(file.id);
        continue;
      }

      // Check if file is supported
      if (!isSupportedMimeType(file.mimeType)) {
        result.skipped++;
        continue;
      }

      filesProcessed++;

      // Check if document already exists
      const existingDoc = await getDocumentByDriveId(file.id);

      if (!existingDoc) {
        // New file - create document (skip getFilePath to save API calls)
        await upsertDocument({
          folder_id: folder.id,
          drive_file_id: file.id,
          file_name: file.name,
          file_path: undefined, // Skip expensive getFilePath call
          mime_type: file.mimeType,
          drive_modified_at: file.modifiedTime.toISOString(),
          file_size_bytes: file.size || undefined,
          truth_priority: folder.truth_priority,
        });
        result.new++;
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
            file_path: existingDoc.file_path || undefined, // Keep existing path
            mime_type: file.mimeType,
            drive_modified_at: file.modifiedTime.toISOString(),
            file_size_bytes: file.size || undefined,
            truth_priority: folder.truth_priority,
          });
          result.updated++;
        }
      }
    }
  }

  return result;
}

/**
 * POST endpoint for manual sync trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
