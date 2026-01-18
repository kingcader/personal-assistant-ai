/**
 * Knowledge Base Folders API
 *
 * Manage synced Google Drive folders.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 *
 * Usage:
 * - GET /api/kb/folders - List all folders with stats
 * - POST /api/kb/folders - Add a new folder
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllFolders,
  createFolder,
  getFolderByDriveId,
  TruthPriority,
} from '@/lib/supabase/kb-queries';
import {
  folderExists,
  getFolderMetadata,
  getDriveFolderUrl,
} from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kb/folders
 * List all folders with their status
 */
export async function GET() {
  try {
    const folders = await getAllFolders();

    // Add Drive URLs to each folder
    const foldersWithUrls = folders.map((folder) => ({
      ...folder,
      driveUrl: getDriveFolderUrl(folder.drive_folder_id),
    }));

    return NextResponse.json({
      success: true,
      folders: foldersWithUrls,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
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
 * POST /api/kb/folders
 * Add a new folder to sync
 *
 * Body: {
 *   driveFolderId: string,  // Google Drive folder ID
 *   truthPriority?: 'standard' | 'high' | 'authoritative'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const { driveFolderId, truthPriority = 'standard' } = body;

    if (!driveFolderId || typeof driveFolderId !== 'string') {
      return NextResponse.json(
        { error: 'driveFolderId is required' },
        { status: 400 }
      );
    }

    // Extract folder ID from URL if provided
    const folderId = extractFolderId(driveFolderId);

    // Check if folder already exists in KB
    const existingFolder = await getFolderByDriveId(folderId);
    if (existingFolder) {
      return NextResponse.json(
        {
          error: 'Folder is already synced',
          folder: existingFolder,
        },
        { status: 409 }
      );
    }

    // Verify folder exists in Google Drive
    const exists = await folderExists(folderId);
    if (!exists) {
      return NextResponse.json(
        {
          error: 'Folder not found in Google Drive. Make sure the folder ID is correct and you have access.',
        },
        { status: 404 }
      );
    }

    // Get folder metadata
    const metadata = await getFolderMetadata(folderId);
    if (!metadata) {
      return NextResponse.json(
        { error: 'Could not retrieve folder metadata' },
        { status: 500 }
      );
    }

    // Create the folder
    const folder = await createFolder({
      drive_folder_id: folderId,
      folder_name: metadata.name,
      truth_priority: truthPriority as TruthPriority,
    });

    console.log(`✅ Added folder: ${metadata.name}`);

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        driveUrl: getDriveFolderUrl(folderId),
      },
      message: `Folder "${metadata.name}" added successfully. Sync will run automatically.`,
    });
  } catch (error) {
    console.error('Error adding folder:', error);
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
 * Extract folder ID from a Google Drive URL or return as-is
 */
function extractFolderId(input: string): string {
  // If it's a URL, extract the ID
  const urlPatterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,  // /folders/ID
    /id=([a-zA-Z0-9_-]+)/,           // ?id=ID
  ];

  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Assume it's already an ID
  return input.trim();
}
