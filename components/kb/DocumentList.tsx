'use client';

import { useState } from 'react';

interface KBCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface KBFolder {
  id: string;
  folder_name: string;
  driveUrl: string;
}

interface KBDocument {
  id: string;
  file_name: string;
  file_path: string | null;
  mime_type: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed' | 'deleted';
  chunk_count: number;
  indexed_at: string | null;
  driveUrl: string;
  categories?: KBCategory[];
  processing_priority?: number;
}

// Priority levels
const PRIORITY_LEVELS = {
  NORMAL: 0,
  HIGH: 5,
  URGENT: 10,
} as const;

interface DocumentListProps {
  folder: KBFolder;
  documents: KBDocument[];
  loading: boolean;
  categories?: KBCategory[];
  onDeleteDocument?: (documentId: string) => Promise<void>;
  onAssignCategory?: (documentId: string, categoryId: string) => Promise<void>;
  onRemoveCategory?: (documentId: string, categoryId: string) => Promise<void>;
  onUpdatePriority?: (documentId: string, priority: number) => Promise<void>;
}

export default function DocumentList({
  folder,
  documents,
  loading,
  categories = [],
  onDeleteDocument,
  onAssignCategory,
  onRemoveCategory,
  onUpdatePriority,
}: DocumentListProps) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('document')) return '📄';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('text')) return '📝';
    if (mimeType.includes('image')) return '🖼️';
    return '📄';
  };

  const getStatusBadge = (status: KBDocument['status']) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      indexed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      deleted: 'bg-gray-100 text-gray-500',
    };

    const labels = {
      pending: 'Pending',
      processing: 'Processing',
      indexed: 'Indexed',
      failed: 'Failed',
      deleted: 'Deleted',
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async (doc: KBDocument) => {
    if (!onDeleteDocument) return;
    if (!confirm(`Delete "${doc.file_name}" from the Knowledge Base? This will remove it from search.`)) {
      return;
    }
    setDeletingDoc(doc.id);
    try {
      await onDeleteDocument(doc.id);
    } finally {
      setDeletingDoc(null);
    }
  };

  const handleAssignCategory = async (docId: string, categoryId: string) => {
    if (!onAssignCategory) return;
    await onAssignCategory(docId, categoryId);
  };

  const handleRemoveCategory = async (docId: string, categoryId: string) => {
    if (!onRemoveCategory) return;
    await onRemoveCategory(docId, categoryId);
  };

  const handlePriorityChange = async (docId: string, priority: number) => {
    if (!onUpdatePriority) return;
    setUpdatingPriority(docId);
    try {
      await onUpdatePriority(docId, priority);
    } finally {
      setUpdatingPriority(null);
    }
  };

  const getPriorityLabel = (priority: number | undefined) => {
    if (!priority || priority === 0) return 'Normal';
    if (priority >= PRIORITY_LEVELS.URGENT) return 'Urgent';
    if (priority >= PRIORITY_LEVELS.HIGH) return 'High';
    return 'Normal';
  };

  const getPriorityBadge = (priority: number | undefined) => {
    const label = getPriorityLabel(priority);
    if (label === 'Urgent') {
      return 'bg-red-100 text-red-700';
    }
    if (label === 'High') {
      return 'bg-orange-100 text-orange-700';
    }
    return '';
  };

  // Get categories not yet assigned to a document
  const getAvailableCategories = (doc: KBDocument) => {
    const assignedIds = new Set(doc.categories?.map((c) => c.id) || []);
    return categories.filter((c) => !assignedIds.has(c.id));
  };

  // Group documents by status
  const groupedDocs = {
    indexed: documents.filter((d) => d.status === 'indexed'),
    pending: documents.filter((d) => d.status === 'pending'),
    processing: documents.filter((d) => d.status === 'processing'),
    failed: documents.filter((d) => d.status === 'failed'),
    deleted: documents.filter((d) => d.status === 'deleted'),
  };

  const visibleDocs = [
    ...groupedDocs.processing,
    ...groupedDocs.pending,
    ...groupedDocs.failed,
    ...groupedDocs.indexed,
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {folder.folder_name}
            </h2>
            <p className="text-sm text-gray-500">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <a
            href={folder.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Open in Drive
          </a>
        </div>
      </div>

      {/* Status Summary */}
      {documents.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex gap-4 text-xs">
          <span className="text-green-600">
            {groupedDocs.indexed.length} indexed
          </span>
          {groupedDocs.pending.length > 0 && (
            <span className="text-yellow-600">
              {groupedDocs.pending.length} pending
            </span>
          )}
          {groupedDocs.processing.length > 0 && (
            <span className="text-blue-600">
              {groupedDocs.processing.length} processing
            </span>
          )}
          {groupedDocs.failed.length > 0 && (
            <span className="text-red-600">
              {groupedDocs.failed.length} failed
            </span>
          )}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No documents in this folder</p>
          <p className="text-sm mt-1">
            Files will appear here after the next sync
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {visibleDocs.map((doc) => (
            <li key={doc.id} className="hover:bg-gray-50 transition-colors">
              <div
                className="px-4 py-3 cursor-pointer"
                onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{getFileIcon(doc.mime_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={doc.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-gray-900 hover:text-blue-600 truncate"
                      >
                        {doc.file_name}
                      </a>
                      {getStatusBadge(doc.status)}
                      {/* Priority badge for pending/failed docs */}
                      {(doc.status === 'pending' || doc.status === 'failed') &&
                        doc.processing_priority !== undefined &&
                        doc.processing_priority > 0 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(
                              doc.processing_priority
                            )}`}
                          >
                            {getPriorityLabel(doc.processing_priority)}
                          </span>
                        )}
                    </div>

                    {/* Category Tags */}
                    {doc.categories && doc.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.categories.map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-1">
                      {doc.file_path && (
                        <span className="mr-3">{doc.file_path}</span>
                      )}
                      {doc.status === 'indexed' && (
                        <>
                          <span>{doc.chunk_count} chunks</span>
                          {doc.indexed_at && (
                            <span className="ml-3">
                              Indexed {formatDate(doc.indexed_at)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">
                    {expandedDoc === doc.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Expanded Actions */}
              {expandedDoc === doc.id && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  {/* Priority Control for pending/failed docs */}
                  {(doc.status === 'pending' || doc.status === 'failed') && onUpdatePriority && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Processing Priority
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={doc.processing_priority || 0}
                          onChange={(e) => handlePriorityChange(doc.id, parseInt(e.target.value))}
                          disabled={updatingPriority === doc.id}
                          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                        >
                          <option value={PRIORITY_LEVELS.NORMAL}>Normal</option>
                          <option value={PRIORITY_LEVELS.HIGH}>High (Process Soon)</option>
                          <option value={PRIORITY_LEVELS.URGENT}>Urgent (Process Next)</option>
                        </select>
                        {updatingPriority === doc.id && (
                          <span className="text-xs text-gray-500">Updating...</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Higher priority documents are processed first by the indexing cron job
                      </p>
                    </div>
                  )}

                  {/* Category Management */}
                  {categories.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Categories
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* Current categories with remove button */}
                        {doc.categories?.map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center text-xs px-2 py-1 rounded-full text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.name}
                            {onRemoveCategory && (
                              <button
                                onClick={() => handleRemoveCategory(doc.id, cat.id)}
                                className="ml-1 hover:opacity-75"
                                title="Remove category"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}

                        {/* Add category dropdown */}
                        {onAssignCategory && getAvailableCategories(doc).length > 0 && (
                          <select
                            className="text-xs px-2 py-1 border border-gray-300 rounded-full bg-white"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignCategory(doc.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            value=""
                          >
                            <option value="">+ Add category</option>
                            {getAvailableCategories(doc).map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <a
                      href={doc.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Open in Drive
                    </a>
                    {onDeleteDocument && (
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={deletingDoc === doc.id}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingDoc === doc.id ? 'Deleting...' : 'Delete from KB'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
