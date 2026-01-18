'use client';

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
}

interface DocumentListProps {
  folder: KBFolder;
  documents: KBDocument[];
  loading: boolean;
}

export default function DocumentList({
  folder,
  documents,
  loading,
}: DocumentListProps) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('document')) return '📄';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('text')) return '📝';
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
            <li
              key={doc.id}
              className="px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{getFileIcon(doc.mime_type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:text-blue-600 truncate"
                    >
                      {doc.file_name}
                    </a>
                    {getStatusBadge(doc.status)}
                  </div>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
