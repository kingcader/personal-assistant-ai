/**
 * Google Drive API Client
 *
 * Fetches files and folders from Google Drive for the Knowledge Base.
 * Uses OAuth 2.0 credentials for authentication.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { google, drive_v3 } from 'googleapis';
import { getGoogleOAuth2Client } from './auth';

/**
 * Drive file metadata structure
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: Date;
  createdTime: Date;
  size: number | null;
  webViewLink: string | null;
  parents: string[];
}

/**
 * Drive folder structure
 */
export interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string | null;
}

/**
 * Pagination result for file listing
 */
export interface FileListResult {
  files: DriveFile[];
  nextPageToken: string | null;
}

/**
 * Supported MIME types for text extraction
 */
export const SUPPORTED_MIME_TYPES = {
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  PDF: 'application/pdf',
  TEXT_PLAIN: 'text/plain',
  TEXT_MARKDOWN: 'text/markdown',
  TEXT_CSV: 'text/csv',
  TEXT_HTML: 'text/html',
} as const;

/**
 * Check if a MIME type is supported for extraction
 */
export function isSupportedMimeType(mimeType: string): boolean {
  const supported = [
    SUPPORTED_MIME_TYPES.GOOGLE_DOC,
    SUPPORTED_MIME_TYPES.GOOGLE_SHEET,
    SUPPORTED_MIME_TYPES.PDF,
    SUPPORTED_MIME_TYPES.TEXT_PLAIN,
    SUPPORTED_MIME_TYPES.TEXT_MARKDOWN,
    SUPPORTED_MIME_TYPES.TEXT_CSV,
    SUPPORTED_MIME_TYPES.TEXT_HTML,
  ];
  return supported.includes(mimeType as typeof SUPPORTED_MIME_TYPES[keyof typeof SUPPORTED_MIME_TYPES]);
}

/**
 * Get authenticated Drive client
 */
export function getDriveClient(): drive_v3.Drive {
  const oauth2Client = getGoogleOAuth2Client();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * List files in a folder with pagination
 *
 * @param folderId - Google Drive folder ID
 * @param pageToken - Token for pagination (optional)
 * @param pageSize - Number of files per page (default: 100)
 */
export async function listFilesInFolder(
  folderId: string,
  pageToken?: string,
  pageSize: number = 100
): Promise<FileListResult> {
  const drive = getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, size, webViewLink, parents)',
    pageSize,
    pageToken,
    orderBy: 'modifiedTime desc',
  });

  const files = (response.data.files || []).map(parseGoogleFile);

  return {
    files,
    nextPageToken: response.data.nextPageToken || null,
  };
}

/**
 * List all files in a folder (handles pagination automatically)
 *
 * @param folderId - Google Drive folder ID
 * @param recursive - Whether to list files in subfolders (default: false)
 * @param supportedOnly - Only return files with supported MIME types (default: true)
 */
export async function listAllFilesInFolder(
  folderId: string,
  recursive: boolean = false,
  supportedOnly: boolean = true
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  const foldersToProcess: string[] = [folderId];

  while (foldersToProcess.length > 0) {
    const currentFolderId = foldersToProcess.pop()!;
    let pageToken: string | undefined;

    do {
      const result = await listFilesInFolder(currentFolderId, pageToken);

      for (const file of result.files) {
        // If it's a folder and we're recursive, add it to the queue
        if (file.mimeType === 'application/vnd.google-apps.folder' && recursive) {
          foldersToProcess.push(file.id);
        } else if (!supportedOnly || isSupportedMimeType(file.mimeType)) {
          allFiles.push(file);
        }
      }

      pageToken = result.nextPageToken || undefined;
    } while (pageToken);
  }

  return allFiles;
}

/**
 * Get file metadata by ID
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, modifiedTime, createdTime, size, webViewLink, parents',
    });

    return parseGoogleFile(response.data);
  } catch (error) {
    console.error(`Error fetching file metadata for ${fileId}:`, error);
    return null;
  }
}

/**
 * Get folder metadata by ID
 */
export async function getFolderMetadata(folderId: string): Promise<DriveFolder | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id || folderId,
      name: response.data.name || 'Unknown',
      webViewLink: response.data.webViewLink || null,
    };
  } catch (error) {
    console.error(`Error fetching folder metadata for ${folderId}:`, error);
    return null;
  }
}

/**
 * Export a Google Doc as plain text
 *
 * @param fileId - Google Drive file ID
 * @returns Plain text content of the document
 */
export async function exportGoogleDoc(fileId: string): Promise<string> {
  const drive = getDriveClient();

  const response = await drive.files.export({
    fileId,
    mimeType: 'text/plain',
  });

  // Response data is the file content
  return response.data as string;
}

/**
 * Export a Google Sheet as CSV
 *
 * @param fileId - Google Drive file ID
 * @returns CSV content of the spreadsheet (first sheet only)
 */
export async function exportGoogleSheetAsCSV(fileId: string): Promise<string> {
  const drive = getDriveClient();

  const response = await drive.files.export({
    fileId,
    mimeType: 'text/csv',
  });

  return response.data as string;
}

/**
 * Download file content (for PDFs, text files, etc.)
 *
 * @param fileId - Google Drive file ID
 * @returns Buffer containing file content
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    {
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Download file content as text (for text-based files)
 *
 * @param fileId - Google Drive file ID
 * @returns Text content of the file
 */
export async function downloadFileAsText(fileId: string): Promise<string> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    {
      responseType: 'text',
    }
  );

  return response.data as string;
}

/**
 * Check if a folder exists and is accessible
 */
export async function folderExists(folderId: string): Promise<boolean> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, mimeType',
    });

    return response.data.mimeType === 'application/vnd.google-apps.folder';
  } catch {
    return false;
  }
}

/**
 * Get the full path of a file (folder names from root)
 *
 * @param fileId - Google Drive file ID
 * @returns Array of folder names from root to file's parent
 */
export async function getFilePath(fileId: string): Promise<string> {
  const drive = getDriveClient();
  const pathParts: string[] = [];

  let currentId = fileId;

  try {
    // First get the file itself to get its parent
    const file = await drive.files.get({
      fileId: currentId,
      fields: 'name, parents',
    });

    // Don't include the file itself in the path
    const parents = file.data.parents || [];
    if (parents.length === 0) return '/';

    currentId = parents[0];

    // Walk up the folder tree
    while (currentId) {
      const folder = await drive.files.get({
        fileId: currentId,
        fields: 'name, parents',
      });

      if (!folder.data.name) break;

      // Stop at "My Drive" or root
      if (folder.data.name === 'My Drive') break;

      pathParts.unshift(folder.data.name);

      const folderParents = folder.data.parents || [];
      if (folderParents.length === 0) break;

      currentId = folderParents[0];
    }

    return '/' + pathParts.join('/');
  } catch (error) {
    console.error(`Error getting file path for ${fileId}:`, error);
    return '/';
  }
}

/**
 * Generate a direct link to open a file in Google Drive
 */
export function getDriveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Generate a direct link to open a folder in Google Drive
 */
export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Parse Google Drive file into our data structure
 */
function parseGoogleFile(file: drive_v3.Schema$File): DriveFile {
  return {
    id: file.id || '',
    name: file.name || 'Untitled',
    mimeType: file.mimeType || 'application/octet-stream',
    modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
    createdTime: file.createdTime ? new Date(file.createdTime) : new Date(),
    size: file.size ? parseInt(file.size, 10) : null,
    webViewLink: file.webViewLink || null,
    parents: file.parents || [],
  };
}

/**
 * Check for files modified since a given date
 *
 * @param folderId - Google Drive folder ID
 * @param since - Only return files modified after this date
 */
export async function listModifiedFilesSince(
  folderId: string,
  since: Date
): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  const sinceISO = since.toISOString();

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and modifiedTime > '${sinceISO}'`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, size, webViewLink, parents)',
      pageSize: 100,
      pageToken,
      orderBy: 'modifiedTime desc',
    });

    const files = (response.data.files || []).map(parseGoogleFile);
    allFiles.push(...files.filter((f) => isSupportedMimeType(f.mimeType)));

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return allFiles;
}
