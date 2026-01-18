'use client';

import { useState } from 'react';

interface KBFolder {
  id: string;
  drive_folder_id: string;
  folder_name: string;
  truth_priority: 'standard' | 'high' | 'authoritative';
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_error: string | null;
  file_count: number;
  indexed_count: number;
  pending_count: number;
  processing_count: number;
  failed_count: number;
  driveUrl: string;
}

interface FolderListProps {
  folders: KBFolder[];
  selectedFolderId: string | null;
  onSelect: (folder: KBFolder) => void;
  onDelete: (folderId: string) => void;
  onUpdatePriority: (folderId: string, priority: string) => void;
  onToggleSync: (folderId: string, enabled: boolean) => void;
}

export default function FolderList({
  folders,
  selectedFolderId,
  onSelect,
  onDelete,
  onUpdatePriority,
  onToggleSync,
}: FolderListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const priorityColors = {
    standard: 'bg-gray-100 text-gray-700',
    high: 'bg-yellow-100 text-yellow-700',
    authoritative: 'bg-green-100 text-green-700',
  };

  const priorityLabels = {
    standard: 'Standard',
    high: 'High',
    authoritative: 'Authoritative',
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Synced Folders</h2>
        <p className="text-sm text-gray-500">
          {folders.length} folder{folders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {folders.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No folders added yet</p>
          <p className="text-sm mt-1">Click &quot;Add Folder&quot; to get started</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                onClick={() => onSelect(folder)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selectedFolderId === folder.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📁</span>
                      <span className="font-medium text-gray-900 truncate">
                        {folder.folder_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          priorityColors[folder.truth_priority]
                        }`}
                      >
                        {priorityLabels[folder.truth_priority]}
                      </span>
                      {!folder.sync_enabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {folder.indexed_count} indexed
                      {folder.pending_count > 0 && (
                        <span className="text-yellow-600">
                          {' '}
                          / {folder.pending_count} pending
                        </span>
                      )}
                      {folder.processing_count > 0 && (
                        <span className="text-blue-600">
                          {' '}
                          / {folder.processing_count} processing
                        </span>
                      )}
                      {folder.failed_count > 0 && (
                        <span className="text-red-600">
                          {' '}
                          / {folder.failed_count} failed
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === folder.id ? null : folder.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedId === folder.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>

                {/* Expanded Options */}
                {expandedId === folder.id && (
                  <div
                    className="mt-3 pt-3 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xs text-gray-500 mb-2">
                      Last synced: {formatDate(folder.last_sync_at)}
                    </div>

                    {folder.last_sync_error && (
                      <div className="text-xs text-red-600 mb-2 p-2 bg-red-50 rounded">
                        {folder.last_sync_error}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {/* Priority Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Priority:</span>
                        <select
                          value={folder.truth_priority}
                          onChange={(e) =>
                            onUpdatePriority(folder.id, e.target.value)
                          }
                          className="text-xs border border-gray-200 rounded px-2 py-1"
                        >
                          <option value="standard">Standard</option>
                          <option value="high">High</option>
                          <option value="authoritative">Authoritative</option>
                        </select>
                      </div>

                      {/* Sync Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={folder.sync_enabled}
                          onChange={(e) =>
                            onToggleSync(folder.id, e.target.checked)
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">
                          Enable sync
                        </span>
                      </label>

                      {/* Actions */}
                      <div className="flex gap-2 mt-2">
                        <a
                          href={folder.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Open in Drive
                        </a>
                        <button
                          onClick={() => onDelete(folder.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
