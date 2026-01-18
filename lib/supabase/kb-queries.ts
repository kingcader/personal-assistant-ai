/**
 * Knowledge Base Query Functions
 *
 * Typed query functions for the Knowledge Base + RAG system.
 * Handles folders, documents, chunks, and semantic search.
 *
 * Part of Loop #5: Knowledge Base + RAG System
 */

import { supabase } from './client';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TruthPriority = 'standard' | 'high' | 'authoritative';
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed' | 'deleted';

export interface KBFolder {
  id: string;
  drive_folder_id: string;
  folder_name: string;
  folder_path: string | null;
  truth_priority: TruthPriority;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  file_count: number;
  created_at: string;
  updated_at: string;
}

export interface KBDocument {
  id: string;
  folder_id: string;
  drive_file_id: string;
  file_name: string;
  file_path: string | null;
  mime_type: string;
  content_hash: string | null;
  drive_modified_at: string | null;
  file_size_bytes: number | null;
  status: DocumentStatus;
  processing_error: string | null;
  extracted_text: string | null;
  truth_priority: TruthPriority | null;
  chunk_count: number;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KBChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  section_title: string | null;
  embedding: number[] | null;
  truth_priority: TruthPriority | null;
  token_count: number | null;
  created_at: string;
}

export interface KBFolderWithStats extends KBFolder {
  indexed_count: number;
  pending_count: number;
  processing_count: number;
  failed_count: number;
}

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  section_title: string | null;
  similarity: number;
  truth_priority: TruthPriority | null;
  file_name: string;
  file_path: string | null;
  drive_file_id: string;
}

// ============================================
// FOLDER QUERIES
// ============================================

/**
 * Get all folders with their status counts
 */
export async function getAllFolders(): Promise<KBFolderWithStats[]> {
  const { data, error } = await (supabase as any)
    .from('kb_folder_status')
    .select('*')
    .order('folder_name', { ascending: true });

  if (error) {
    console.error('Error fetching folders:', error);
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }

  return data as KBFolderWithStats[];
}

/**
 * Get a folder by ID
 */
export async function getFolderById(folderId: string): Promise<KBFolder | null> {
  const { data, error } = await (supabase as any)
    .from('kb_folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch folder: ${error.message}`);
  }

  return data as KBFolder;
}

/**
 * Get a folder by Drive folder ID
 */
export async function getFolderByDriveId(driveFolderId: string): Promise<KBFolder | null> {
  const { data, error } = await (supabase as any)
    .from('kb_folders')
    .select('*')
    .eq('drive_folder_id', driveFolderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch folder: ${error.message}`);
  }

  return data as KBFolder;
}

/**
 * Create a new folder
 */
export async function createFolder(params: {
  drive_folder_id: string;
  folder_name: string;
  folder_path?: string;
  truth_priority?: TruthPriority;
}): Promise<KBFolder> {
  const { data, error } = await (supabase as any)
    .from('kb_folders')
    .insert({
      drive_folder_id: params.drive_folder_id,
      folder_name: params.folder_name,
      folder_path: params.folder_path || null,
      truth_priority: params.truth_priority || 'standard',
      sync_enabled: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create folder: ${error.message}`);
  }

  return data as KBFolder;
}

/**
 * Update folder settings
 */
export async function updateFolder(
  folderId: string,
  updates: Partial<Pick<KBFolder, 'folder_name' | 'truth_priority' | 'sync_enabled'>>
): Promise<KBFolder> {
  const { data, error } = await (supabase as any)
    .from('kb_folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update folder: ${error.message}`);
  }

  return data as KBFolder;
}

/**
 * Update folder sync status
 */
export async function updateFolderSyncStatus(
  folderId: string,
  params: {
    last_sync_at?: string;
    last_sync_error?: string | null;
    file_count?: number;
  }
): Promise<void> {
  const { error } = await (supabase as any)
    .from('kb_folders')
    .update(params)
    .eq('id', folderId);

  if (error) {
    throw new Error(`Failed to update folder sync status: ${error.message}`);
  }
}

/**
 * Delete a folder and all its documents
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('kb_folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`);
  }
}

/**
 * Get enabled folders for sync
 */
export async function getEnabledFolders(): Promise<KBFolder[]> {
  const { data, error } = await (supabase as any)
    .from('kb_folders')
    .select('*')
    .eq('sync_enabled', true);

  if (error) {
    throw new Error(`Failed to fetch enabled folders: ${error.message}`);
  }

  return data as KBFolder[];
}

// ============================================
// DOCUMENT QUERIES
// ============================================

/**
 * Get documents in a folder
 */
export async function getDocumentsInFolder(
  folderId: string,
  status?: DocumentStatus
): Promise<KBDocument[]> {
  let query = (supabase as any)
    .from('kb_documents')
    .select('*')
    .eq('folder_id', folderId)
    .order('file_name', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data as KBDocument[];
}

/**
 * Get document by ID
 */
export async function getDocumentById(documentId: string): Promise<KBDocument | null> {
  const { data, error } = await (supabase as any)
    .from('kb_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as KBDocument;
}

/**
 * Get document by Drive file ID
 */
export async function getDocumentByDriveId(driveFileId: string): Promise<KBDocument | null> {
  const { data, error } = await (supabase as any)
    .from('kb_documents')
    .select('*')
    .eq('drive_file_id', driveFileId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as KBDocument;
}

/**
 * Upsert a document (create or update by Drive file ID)
 */
export async function upsertDocument(params: {
  folder_id: string;
  drive_file_id: string;
  file_name: string;
  file_path?: string;
  mime_type: string;
  drive_modified_at?: string;
  file_size_bytes?: number;
  truth_priority?: TruthPriority;
}): Promise<KBDocument> {
  const { data, error } = await (supabase as any)
    .from('kb_documents')
    .upsert(
      {
        folder_id: params.folder_id,
        drive_file_id: params.drive_file_id,
        file_name: params.file_name,
        file_path: params.file_path || null,
        mime_type: params.mime_type,
        drive_modified_at: params.drive_modified_at || null,
        file_size_bytes: params.file_size_bytes || null,
        truth_priority: params.truth_priority || null,
        status: 'pending',
      },
      { onConflict: 'drive_file_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert document: ${error.message}`);
  }

  return data as KBDocument;
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  error?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status };

  if (error) {
    updates.processing_error = error;
  }

  if (status === 'indexed') {
    updates.indexed_at = new Date().toISOString();
  }

  const { error: updateError } = await (supabase as any)
    .from('kb_documents')
    .update(updates)
    .eq('id', documentId);

  if (updateError) {
    throw new Error(`Failed to update document status: ${updateError.message}`);
  }
}

/**
 * Update document with extracted text
 */
export async function updateDocumentExtractedText(
  documentId: string,
  extractedText: string,
  contentHash: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('kb_documents')
    .update({
      extracted_text: extractedText,
      content_hash: contentHash,
      status: 'processing',
    })
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document text: ${error.message}`);
  }
}

/**
 * Get pending documents for processing
 */
export async function getPendingDocuments(limit: number = 10): Promise<KBDocument[]> {
  const { data, error } = await (supabase as any)
    .from('kb_documents_pending')
    .select('*')
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch pending documents: ${error.message}`);
  }

  return data as KBDocument[];
}

/**
 * Mark documents as deleted (for files removed from Drive)
 */
export async function markDocumentsDeleted(driveFileIds: string[]): Promise<void> {
  if (driveFileIds.length === 0) return;

  const { error } = await (supabase as any)
    .from('kb_documents')
    .update({ status: 'deleted' })
    .in('drive_file_id', driveFileIds);

  if (error) {
    throw new Error(`Failed to mark documents as deleted: ${error.message}`);
  }
}

/**
 * Reset failed documents to pending status for retry
 * Used when adding new extraction capabilities (like AI vision)
 */
export async function resetFailedDocuments(folderId?: string): Promise<number> {
  let query = (supabase as any)
    .from('kb_documents')
    .update({
      status: 'pending',
      processing_error: null,
    })
    .eq('status', 'failed');

  if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query.select('id');

  if (error) {
    throw new Error(`Failed to reset failed documents: ${error.message}`);
  }

  return data?.length || 0;
}

// ============================================
// CHUNK QUERIES
// ============================================

/**
 * Create chunks for a document
 */
export async function createChunks(
  documentId: string,
  chunks: Array<{
    content: string;
    chunk_index: number;
    section_title: string | null;
    embedding: number[];
    truth_priority: TruthPriority | null;
    token_count: number;
  }>
): Promise<void> {
  // First, delete existing chunks for this document
  const { error: deleteError } = await (supabase as any)
    .from('kb_chunks')
    .delete()
    .eq('document_id', documentId);

  if (deleteError) {
    throw new Error(`Failed to delete existing chunks: ${deleteError.message}`);
  }

  // Insert new chunks
  // Format embedding as pgvector literal: [0.1, 0.2, ...]
  const chunkData = chunks.map((chunk) => ({
    document_id: documentId,
    content: chunk.content,
    chunk_index: chunk.chunk_index,
    section_title: chunk.section_title,
    embedding: `[${chunk.embedding.join(',')}]`,
    truth_priority: chunk.truth_priority,
    token_count: chunk.token_count,
  }));

  const { error: insertError } = await (supabase as any)
    .from('kb_chunks')
    .insert(chunkData);

  if (insertError) {
    throw new Error(`Failed to create chunks: ${insertError.message}`);
  }

  // Update document chunk count
  const { error: updateError } = await (supabase as any)
    .from('kb_documents')
    .update({
      chunk_count: chunks.length,
      status: 'indexed',
      indexed_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (updateError) {
    throw new Error(`Failed to update document chunk count: ${updateError.message}`);
  }
}

/**
 * Get chunks for a document
 */
export async function getChunksForDocument(documentId: string): Promise<KBChunk[]> {
  const { data, error } = await (supabase as any)
    .from('kb_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chunks: ${error.message}`);
  }

  return data as KBChunk[];
}

// ============================================
// SEMANTIC SEARCH
// ============================================

/**
 * Search chunks using vector similarity
 */
export async function searchChunks(params: {
  queryEmbedding: number[];
  limit?: number;
  threshold?: number;
  truthPriorityFilter?: TruthPriority;
}): Promise<SearchResult[]> {
  const {
    queryEmbedding,
    limit = 10,
    threshold = 0.7,
    truthPriorityFilter,
  } = params;

  // Call the match_kb_chunks function
  // Format embedding as a PostgreSQL vector literal: [0.1, 0.2, ...] -> '[0.1,0.2,...]'
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await (supabase as any).rpc('match_kb_chunks', {
    query_embedding: embeddingString,
    match_threshold: threshold,
    match_count: limit,
    filter_truth_priority: truthPriorityFilter || null,
  });

  if (error) {
    throw new Error(`Failed to search chunks: ${error.message}`);
  }

  return data as SearchResult[];
}

/**
 * Log a search query for analytics
 */
export async function logSearchQuery(params: {
  query: string;
  queryEmbedding: number[];
  resultCount: number;
  topChunkIds: string[];
  searchDurationMs: number;
  contextType?: string;
  contextId?: string;
}): Promise<void> {
  const { error } = await (supabase as any)
    .from('kb_search_history')
    .insert({
      query: params.query,
      query_embedding: JSON.stringify(params.queryEmbedding),
      result_count: params.resultCount,
      top_chunk_ids: params.topChunkIds,
      search_duration_ms: params.searchDurationMs,
      context_type: params.contextType || null,
      context_id: params.contextId || null,
    });

  if (error) {
    console.error('Failed to log search query:', error);
    // Don't throw - logging failures shouldn't break search
  }
}

// ============================================
// TASK-DOCUMENT LINKS
// ============================================

/**
 * Link a document to a task
 */
export async function linkDocumentToTask(params: {
  taskId: string;
  documentId: string;
  relevanceScore: number;
  autoLinked?: boolean;
}): Promise<void> {
  const { error } = await (supabase as any)
    .from('task_documents')
    .upsert(
      {
        task_id: params.taskId,
        document_id: params.documentId,
        relevance_score: params.relevanceScore,
        auto_linked: params.autoLinked ?? true,
      },
      { onConflict: 'task_id,document_id' }
    );

  if (error) {
    throw new Error(`Failed to link document to task: ${error.message}`);
  }
}

/**
 * Get documents linked to a task
 */
export async function getDocumentsForTask(taskId: string): Promise<
  Array<{
    document: KBDocument;
    relevance_score: number;
    auto_linked: boolean;
  }>
> {
  const { data, error } = await (supabase as any)
    .from('task_documents')
    .select(`
      relevance_score,
      auto_linked,
      document:kb_documents(*)
    `)
    .eq('task_id', taskId)
    .order('relevance_score', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents for task: ${error.message}`);
  }

  return data.map((row: any) => ({
    document: row.document as KBDocument,
    relevance_score: row.relevance_score,
    auto_linked: row.auto_linked,
  }));
}

/**
 * Remove document-task link
 */
export async function unlinkDocumentFromTask(
  taskId: string,
  documentId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('task_documents')
    .delete()
    .eq('task_id', taskId)
    .eq('document_id', documentId);

  if (error) {
    throw new Error(`Failed to unlink document from task: ${error.message}`);
  }
}
