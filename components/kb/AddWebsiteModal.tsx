'use client';

import { useState } from 'react';

interface AddWebsiteModalProps {
  onClose: () => void;
  onAdd: (url: string, name: string, maxDepth: number, maxPages: number) => Promise<void>;
}

export default function AddWebsiteModal({ onClose, onAdd }: AddWebsiteModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic URL validation
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    try {
      await onAdd(normalizedUrl, name.trim(), maxDepth, maxPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add website');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add Website to Crawl</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter a website URL to index its content for search
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL *
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the homepage or starting page URL
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Company Website"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use the domain name
              </p>
            </div>

            {/* Crawl Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Depth
                </label>
                <select
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value={1}>1 (Homepage only)</option>
                  <option value={2}>2 (Recommended)</option>
                  <option value={3}>3 (Deep crawl)</option>
                  <option value={4}>4 (Very deep)</option>
                  <option value={5}>5 (Maximum)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Pages
                </label>
                <select
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value={10}>10 pages</option>
                  <option value={25}>25 pages</option>
                  <option value={50}>50 pages (Recommended)</option>
                  <option value={100}>100 pages</option>
                  <option value={200}>200 pages</option>
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <strong>Note:</strong> The crawler respects robots.txt and rate limits requests.
              Initial crawl may be triggered automatically within the next cron cycle.
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Website'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
