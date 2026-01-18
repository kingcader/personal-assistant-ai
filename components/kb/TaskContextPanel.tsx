'use client';

import { useState, useEffect, useCallback } from 'react';

interface LinkedDocument {
  id: string;
  fileName: string;
  filePath: string | null;
  relevanceScore: number;
  autoLinked: boolean;
  driveUrl: string;
  status: string;
}

interface SuggestedDocument {
  documentId: string;
  similarity: number;
  fileName: string;
  driveUrl: string;
}

interface TaskContextPanelProps {
  taskId: string;
}

export default function TaskContextPanel({ taskId }: TaskContextPanelProps) {
  const [linkedDocs, setLinkedDocs] = useState<LinkedDocument[]>([]);
  const [suggestedDocs, setSuggestedDocs] = useState<SuggestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch linked documents
  const fetchLinkedDocs = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/context`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch documents');
      }

      setLinkedDocs(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Find related documents
  const findRelatedDocs = async () => {
    setFinding(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoLink: true }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to find documents');
      }

      setSuggestedDocs(data.suggestedDocuments || []);

      // Refresh linked docs
      if (data.linkedCount > 0) {
        fetchLinkedDocs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFinding(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLinkedDocs();
  }, [fetchLinkedDocs]);

  const formatScore = (score: number) => `${Math.round(score * 100)}%`;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-gray-500 text-sm">Loading context...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Related Documents</h3>
          <button
            onClick={findRelatedDocs}
            disabled={finding}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {finding ? 'Finding...' : 'Find Related'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Linked Documents */}
        {linkedDocs.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Linked
            </h4>
            <ul className="space-y-2">
              {linkedDocs.map((doc) => (
                <li key={doc.id} className="flex items-start gap-2">
                  <span className="text-lg">📄</span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={doc.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 truncate block"
                    >
                      {doc.fileName}
                    </a>
                    <div className="text-xs text-gray-500">
                      {formatScore(doc.relevanceScore)} match
                      {doc.autoLinked && (
                        <span className="ml-2 text-green-600">Auto-linked</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested Documents */}
        {suggestedDocs.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Suggested
            </h4>
            <ul className="space-y-2">
              {suggestedDocs
                .filter(
                  (doc) => !linkedDocs.some((ld) => ld.id === doc.documentId)
                )
                .slice(0, 5)
                .map((doc) => (
                  <li key={doc.documentId} className="flex items-start gap-2">
                    <span className="text-lg opacity-50">📄</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-700 hover:text-blue-600 truncate block"
                      >
                        {doc.fileName}
                      </a>
                      <div className="text-xs text-gray-400">
                        {formatScore(doc.similarity)} match
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Empty State */}
        {linkedDocs.length === 0 && suggestedDocs.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No related documents found</p>
            <button
              onClick={findRelatedDocs}
              disabled={finding}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Search Knowledge Base
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
