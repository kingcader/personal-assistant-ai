'use client';

import { useState } from 'react';

interface AddFolderModalProps {
  onClose: () => void;
  onAdd: (driveFolderId: string, truthPriority: string) => Promise<void>;
}

export default function AddFolderModal({ onClose, onAdd }: AddFolderModalProps) {
  const [folderId, setFolderId] = useState('');
  const [truthPriority, setTruthPriority] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folderId.trim()) {
      setError('Please enter a folder ID or URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onAdd(folderId.trim(), truthPriority);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add folder');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Add Google Drive Folder
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter a Google Drive folder ID or URL to sync
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4">
              {/* Folder ID Input */}
              <div>
                <label
                  htmlFor="folderId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Folder ID or URL
                </label>
                <input
                  id="folderId"
                  type="text"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs or Google Drive URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can paste the full URL from your browser or just the folder ID
                </p>
              </div>

              {/* Truth Priority */}
              <div>
                <label
                  htmlFor="truthPriority"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Truth Priority
                </label>
                <select
                  id="truthPriority"
                  value={truthPriority}
                  onChange={(e) => setTruthPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="authoritative">Authoritative</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Higher priority documents are ranked higher in search results
                </p>
              </div>

              {/* Priority Explanation */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                    Standard
                  </span>
                  <span className="text-xs text-gray-600">
                    General reference documents
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    High
                  </span>
                  <span className="text-xs text-gray-600">
                    Important business documents (1.25x boost)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Authoritative
                  </span>
                  <span className="text-xs text-gray-600">
                    Source of truth documents (1.5x boost)
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
