'use client';

import { useEffect, useState, useCallback } from 'react';
import FolderList from '@/components/kb/FolderList';
import DocumentList from '@/components/kb/DocumentList';
import SearchBar, { SearchMode } from '@/components/kb/SearchBar';
import SearchResults from '@/components/kb/SearchResults';
import AnswerPanel from '@/components/kb/AnswerPanel';
import AddFolderModal from '@/components/kb/AddFolderModal';
import AddWebsiteModal from '@/components/kb/AddWebsiteModal';
import WebsiteList from '@/components/kb/WebsiteList';
import CategoryManager from '@/components/kb/CategoryManager';

interface KBCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

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
  categories?: KBCategory[];
  processing_priority?: number;
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

interface AnswerCitation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

interface AnswerResult {
  answer: string;
  citations: AnswerCitation[];
  confidence: 'high' | 'medium' | 'low';
  chunksUsed: number;
  keyPoints: string[];
  gaps: string[];
}

interface KBWebsite {
  id: string;
  url: string;
  name: string;
  max_depth: number;
  max_pages: number;
  status: 'pending' | 'crawling' | 'indexed' | 'failed';
  last_crawl_at: string | null;
  page_count: number;
  crawl_error: string | null;
  created_at: string;
  indexed_count?: number;
  pending_count?: number;
  processing_count?: number;
  failed_count?: number;
}

export default function KnowledgeBasePage() {
  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<KBFolder | null>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'folders' | 'websites' | 'categories'>('folders');
  const [websites, setWebsites] = useState<KBWebsite[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('answer');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Fetch websites
  const fetchWebsites = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/websites');
      const data = await response.json();
      if (data.success) {
        setWebsites(data.websites);
      }
    } catch (err) {
      console.error('Error fetching websites:', err);
    }
  }, []);

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
  const handleSearch = async (query: string, mode: SearchMode = searchMode) => {
    if (!query.trim()) {
      setSearchResults(null);
      setAnswerResult(null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSelectedFolder(null);
    setSearchResults(null);
    setAnswerResult(null);

    try {
      if (mode === 'answer') {
        // Use answer endpoint for AI-synthesized answers
        const response = await fetch('/api/kb/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 8 }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Answer generation failed');
        }

        setAnswerResult({
          answer: data.answer,
          citations: data.citations,
          confidence: data.confidence,
          chunksUsed: data.chunksUsed,
          keyPoints: data.keyPoints,
          gaps: data.gaps,
        });
      } else {
        // Use search endpoint for raw chunks
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
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Switch from answer to raw search results
  const handleShowRawResults = async () => {
    if (searchQuery) {
      setSearchMode('search');
      await handleSearch(searchQuery, 'search');
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setAnswerResult(null);
    setSearchError(null);
  };

  // Category management
  const handleCreateCategory = async (name: string, description: string, color: string) => {
    try {
      const response = await fetch('/api/kb/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create category');
      }

      setToast({ message: `Category "${name}" created`, type: 'success' });
      fetchCategories();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to create category',
        type: 'error',
      });
    }
  };

  const handleUpdateCategory = async (id: string, name: string, description: string, color: string) => {
    try {
      const response = await fetch(`/api/kb/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update category');
      }

      setToast({ message: `Category "${name}" updated`, type: 'success' });
      fetchCategories();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update category',
        type: 'error',
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/kb/categories/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete category');
      }

      setToast({ message: 'Category deleted', type: 'success' });
      fetchCategories();
      // Refresh documents to update category display
      if (selectedFolder) {
        fetchDocuments(selectedFolder.id);
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete category',
        type: 'error',
      });
    }
  };

  // Document category management
  const handleAssignCategory = async (documentId: string, categoryId: string) => {
    try {
      const response = await fetch(`/api/kb/documents/${documentId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to assign category');
      }

      // Update the document in state with new categories
      setDocuments((docs) =>
        docs.map((doc) =>
          doc.id === documentId ? { ...doc, categories: data.categories } : doc
        )
      );
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to assign category',
        type: 'error',
      });
    }
  };

  const handleRemoveCategory = async (documentId: string, categoryId: string) => {
    try {
      const response = await fetch(
        `/api/kb/documents/${documentId}/categories?categoryId=${categoryId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove category');
      }

      // Update the document in state with new categories
      setDocuments((docs) =>
        docs.map((doc) =>
          doc.id === documentId ? { ...doc, categories: data.categories } : doc
        )
      );
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to remove category',
        type: 'error',
      });
    }
  };

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/kb/documents/${documentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete document');
      }

      setToast({ message: `Deleted "${data.deletedDocument.fileName}"`, type: 'success' });
      // Remove document from state
      setDocuments((docs) => docs.filter((doc) => doc.id !== documentId));
      // Refresh folder counts
      fetchFolders();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete document',
        type: 'error',
      });
    }
  };

  // Update document priority
  const handleUpdateDocumentPriority = async (documentId: string, priority: number) => {
    try {
      const response = await fetch(`/api/kb/documents/${documentId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update priority');
      }

      setToast({ message: data.message, type: 'success' });
      // Update the document in state with new priority
      setDocuments((docs) =>
        docs.map((doc) =>
          doc.id === documentId ? { ...doc, processing_priority: priority } : doc
        )
      );
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update priority',
        type: 'error',
      });
    }
  };

  // Add website
  const handleAddWebsite = async (url: string, name: string, maxDepth: number, maxPages: number) => {
    try {
      const response = await fetch('/api/kb/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name, maxDepth, maxPages }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to add website');
      }

      setToast({ message: data.message, type: 'success' });
      setShowAddWebsiteModal(false);
      fetchWebsites();
    } catch (err) {
      throw err; // Re-throw to let modal handle the error
    }
  };

  // Delete website
  const handleDeleteWebsite = async (websiteId: string) => {
    try {
      const response = await fetch(`/api/kb/websites/${websiteId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete website');
      }

      setToast({ message: data.message, type: 'success' });
      fetchWebsites();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to delete website',
        type: 'error',
      });
    }
  };

  // Recrawl website
  const handleRecrawlWebsite = async (websiteId: string) => {
    try {
      const response = await fetch(`/api/kb/websites/${websiteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recrawl' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to queue recrawl');
      }

      setToast({ message: data.message, type: 'success' });
      fetchWebsites();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to queue recrawl',
        type: 'error',
      });
    }
  };

  // Update website
  const handleUpdateWebsite = async (
    websiteId: string,
    updates: { name?: string; max_depth?: number; max_pages?: number }
  ) => {
    try {
      const response = await fetch(`/api/kb/websites/${websiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update website');
      }

      setToast({ message: 'Website updated', type: 'success' });
      fetchWebsites();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update website',
        type: 'error',
      });
    }
  };

  // Initial load
  useEffect(() => {
    fetchFolders();
    fetchCategories();
    fetchWebsites();
  }, [fetchFolders, fetchCategories, fetchWebsites]);

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
              <button
                onClick={() => setShowAddWebsiteModal(true)}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Website
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
            mode={searchMode}
            onModeChange={setSearchMode}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searching ? (
          /* Loading state for answer mode */
          searchMode === 'answer' ? (
            <AnswerPanel
              query={searchQuery}
              answer=""
              citations={[]}
              confidence="low"
              chunksUsed={0}
              keyPoints={[]}
              gaps={[]}
              loading={true}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="text-gray-500">Searching...</div>
            </div>
          )
        ) : answerResult !== null ? (
          <AnswerPanel
            query={searchQuery}
            answer={answerResult.answer}
            citations={answerResult.citations}
            confidence={answerResult.confidence}
            chunksUsed={answerResult.chunksUsed}
            keyPoints={answerResult.keyPoints}
            gaps={answerResult.gaps}
            onShowRawResults={handleShowRawResults}
          />
        ) : searchResults !== null ? (
          <SearchResults
            results={searchResults}
            query={searchQuery}
            error={searchError}
          />
        ) : searchError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{searchError}</p>
          </div>
        ) : (
          /* Folder/Document View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Tabs for Folders/Categories */}
            <div className="lg:col-span-1 space-y-4">
              {/* Tab Buttons */}
              <div className="flex border-b border-gray-200 bg-white rounded-t-lg">
                <button
                  onClick={() => setActiveTab('folders')}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'folders'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Folders
                </button>
                <button
                  onClick={() => setActiveTab('websites')}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'websites'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Websites ({websites.length})
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'categories'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Categories
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'folders' ? (
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
              ) : activeTab === 'websites' ? (
                <WebsiteList
                  websites={websites}
                  onDelete={handleDeleteWebsite}
                  onRecrawl={handleRecrawlWebsite}
                  onUpdate={handleUpdateWebsite}
                />
              ) : (
                <CategoryManager
                  categories={categories}
                  onCreateCategory={handleCreateCategory}
                  onUpdateCategory={handleUpdateCategory}
                  onDeleteCategory={handleDeleteCategory}
                />
              )}
            </div>

            {/* Documents Panel */}
            <div className="lg:col-span-2">
              {selectedFolder ? (
                <DocumentList
                  folder={selectedFolder}
                  documents={documents}
                  loading={loadingDocs}
                  categories={categories}
                  onDeleteDocument={handleDeleteDocument}
                  onAssignCategory={handleAssignCategory}
                  onRemoveCategory={handleRemoveCategory}
                  onUpdatePriority={handleUpdateDocumentPriority}
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

      {/* Add Website Modal */}
      {showAddWebsiteModal && (
        <AddWebsiteModal
          onClose={() => setShowAddWebsiteModal(false)}
          onAdd={handleAddWebsite}
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
