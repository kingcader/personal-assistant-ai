'use client';

import { useState } from 'react';

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

interface WebsiteListProps {
  websites: KBWebsite[];
  onDelete: (websiteId: string) => Promise<void>;
  onRecrawl: (websiteId: string) => Promise<void>;
  onUpdate: (websiteId: string, updates: { name?: string; max_depth?: number; max_pages?: number }) => Promise<void>;
}

export default function WebsiteList({
  websites,
  onDelete,
  onRecrawl,
  onUpdate,
}: WebsiteListProps) {
  const [expandedWebsite, setExpandedWebsite] = useState<string | null>(null);
  const [deletingWebsite, setDeletingWebsite] = useState<string | null>(null);
  const [recrawling, setRecrawling] = useState<string | null>(null);

  const getStatusBadge = (status: KBWebsite['status']) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-700',
      crawling: 'bg-blue-100 text-blue-700',
      indexed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };

    const labels = {
      pending: 'Pending',
      crawling: 'Crawling',
      indexed: 'Indexed',
      failed: 'Failed',
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${badges[status]}`}>
        {labels[status]}
      </span>
    );
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

  const handleDelete = async (website: KBWebsite) => {
    if (!confirm(`Delete "${website.name}" and all crawled pages? This action cannot be undone.`)) {
      return;
    }
    setDeletingWebsite(website.id);
    try {
      await onDelete(website.id);
    } finally {
      setDeletingWebsite(null);
    }
  };

  const handleRecrawl = async (website: KBWebsite) => {
    setRecrawling(website.id);
    try {
      await onRecrawl(website.id);
    } finally {
      setRecrawling(null);
    }
  };

  if (websites.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">🌐</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Websites Added</h3>
        <p className="text-gray-500 text-sm">
          Add a website to crawl and index its content for search.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <ul className="divide-y divide-gray-100">
        {websites.map((website) => (
          <li key={website.id}>
            <div
              className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedWebsite(expandedWebsite === website.id ? null : website.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">🌐</span>
                    <span className="font-medium text-gray-900 truncate">
                      {website.name}
                    </span>
                    {getStatusBadge(website.status)}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {website.url}
                  </p>
                  <div className="text-xs text-gray-400 mt-1 flex gap-3">
                    <span>{website.page_count} pages</span>
                    <span>Depth: {website.max_depth}</span>
                    <span>Last crawl: {formatDate(website.last_crawl_at)}</span>
                  </div>
                </div>
                <span className="text-gray-400 text-sm ml-2">
                  {expandedWebsite === website.id ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {/* Expanded Actions */}
            {expandedWebsite === website.id && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                {/* Status Counts */}
                {(website.indexed_count !== undefined || website.pending_count !== undefined) && (
                  <div className="flex gap-4 text-xs mb-3">
                    {website.indexed_count !== undefined && website.indexed_count > 0 && (
                      <span className="text-green-600">{website.indexed_count} indexed</span>
                    )}
                    {website.pending_count !== undefined && website.pending_count > 0 && (
                      <span className="text-yellow-600">{website.pending_count} pending</span>
                    )}
                    {website.processing_count !== undefined && website.processing_count > 0 && (
                      <span className="text-blue-600">{website.processing_count} processing</span>
                    )}
                    {website.failed_count !== undefined && website.failed_count > 0 && (
                      <span className="text-red-600">{website.failed_count} failed</span>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {website.crawl_error && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {website.crawl_error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <a
                    href={website.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Open Website
                  </a>
                  <button
                    onClick={() => handleRecrawl(website)}
                    disabled={recrawling === website.id || website.status === 'crawling'}
                    className="text-sm text-green-600 hover:text-green-800 disabled:opacity-50"
                  >
                    {recrawling === website.id ? 'Queueing...' : 'Recrawl Now'}
                  </button>
                  <button
                    onClick={() => handleDelete(website)}
                    disabled={deletingWebsite === website.id}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {deletingWebsite === website.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
