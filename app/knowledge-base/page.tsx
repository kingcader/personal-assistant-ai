'use client';

import { useEffect, useState, useCallback } from 'react';
import FolderList from '@/components/kb/FolderList';
import DocumentList from '@/components/kb/DocumentList';
import SearchBar from '@/components/kb/SearchBar';
import SearchResults from '@/components/kb/SearchResults';
import AddFolderModal from '@/components/kb/AddFolderModal';

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

interface SearchResult {
  chunkId: string;
  content: string;
  documentPath: string | null;
  fileName: string;
  sectionTitle: string | null;
  similarity: number;
  truthPriority: string | null;
  driveUrl: string;
}

export default function KnowledgeBasePage() {
  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<KBFolder | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/folders');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch folders');
      }

      setFolders(data.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch documents for selected folder
  const fetchDocuments = useCallback(async (folderId: string) => {
    setLoadingDocs(true);
    try {
      const response = await fetch(`/api/kb/folders/${folderId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch documents');
      }

      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // Select a folder
  const handleSelectFolder = useCallback(
    (folder: KBFolder) => {
      setSelectedFolder(folder);
      setSearchResults(null); // Clear search when selecting folder
      fetchDocuments(folder.id);
    },
    [fetchDocuments]
  );

  // Add a new folder
  const handleAddFolder = async (driveFolderId: string, truthPriority: string) => {
    try {
      const response = await fetch('/api/kb/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFolderId, truthPriority }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to add folder');
      }

      setToast({ message: data.message, type: 'success' });
      setShowAddModal(false);
      fetchFolders();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to add folder',
        type: 'error',
      });
    }
  };

  // Delete a folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure? This will remove all documents and search data for this folder.')) {
      return;
    }

    try {
      const response = await fetch(`/api/kb/folders/${folderId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete folder');
      }

      setToast({ message: data.message, type: 'success' });
      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
        setDocuments([]);
      }
      fetchFolders();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete folder',
        type: 'error',
      });
    }
  };

  // Update folder settings
  const handleUpdateFolder = async (
    folderId: string,
    updates: { truth_priority?: string; sync_enabled?: boolean }
  ) => {
    try {
      const response = await fetch(`/api/kb/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update folder');
      }

      setToast({ message: 'Folder updated', type: 'success' });
      fetchFolders();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update folder',
        type: 'error',
      });
    }
  };

  // Trigger manual sync
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/cron/sync-drive', {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      setToast({
        message: `Synced ${data.files_new} new files, ${data.files_updated} updated`,
        type: 'success',
      });
      fetchFolders();
      if (selectedFolder) {
        fetchDocuments(selectedFolder.id);
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Sync failed',
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Search
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSelectedFolder(null);

    try {
      const response = await fetch('/api/kb/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
  };

  // Initial load
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading Knowledge Base...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
              <p className="text-sm text-gray-500 mt-1">
                Search and manage your synced documents
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Folder
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            loading={searching}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchResults !== null ? (
          <SearchResults
            results={searchResults}
            query={searchQuery}
            error={searchError}
          />
        ) : (
          /* Folder/Document View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Folders Panel */}
            <div className="lg:col-span-1">
              <FolderList
                folders={folders}
                selectedFolderId={selectedFolder?.id || null}
                onSelect={handleSelectFolder}
                onDelete={handleDeleteFolder}
                onUpdatePriority={(id, priority) =>
                  handleUpdateFolder(id, { truth_priority: priority })
                }
                onToggleSync={(id, enabled) =>
                  handleUpdateFolder(id, { sync_enabled: enabled })
                }
              />
            </div>

            {/* Documents Panel */}
            <div className="lg:col-span-2">
              {selectedFolder ? (
                <DocumentList
                  folder={selectedFolder}
                  documents={documents}
                  loading={loadingDocs}
                />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                  <p>Select a folder to view documents</p>
                  <p className="text-sm mt-2">
                    Or use the search bar to find content across all documents
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Folder Modal */}
      {showAddModal && (
        <AddFolderModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddFolder}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
