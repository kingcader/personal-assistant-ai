'use client';

import { useState } from 'react';

interface EmailResult {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  senderEmail: string;
  date: string;
  threadId?: string;
  hasAttachments?: boolean;
}

interface EmailSearchResultsProps {
  results: EmailResult[];
  query?: string;
  totalCount?: number;
}

export default function EmailSearchResults({
  results,
  query,
  totalCount,
}: EmailSearchResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const highlightQuery = (text: string) => {
    if (!query || !text) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (results.length === 0) {
    return (
      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <svg
          className="w-8 h-8 mx-auto text-gray-400 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-gray-500">No emails found matching your search.</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span>
            Found {totalCount || results.length} email{(totalCount || results.length) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-2">
        {results.map((email) => (
          <div
            key={email.id}
            className={`p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer ${
              expandedId === email.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Subject */}
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {highlightQuery(email.subject)}
                </h4>

                {/* Sender and date */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600 truncate">
                    {email.sender}
                  </span>
                  {email.hasAttachments && (
                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  )}
                </div>

                {/* Snippet */}
                <p className={`text-xs text-gray-500 mt-1 ${expandedId === email.id ? '' : 'line-clamp-2'}`}>
                  {highlightQuery(email.snippet)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400">
                  {formatDate(email.date)}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedId === email.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded details */}
            {expandedId === email.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-12">From:</span>
                    <span className="text-gray-900">{email.sender}</span>
                    <span className="text-gray-400">({email.senderEmail})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-12">Date:</span>
                    <span className="text-gray-900">
                      {new Date(email.date).toLocaleString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </div>
                  {email.threadId && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 w-12">Thread:</span>
                      <span className="text-gray-400 font-mono text-[10px] truncate">
                        {email.threadId}
                      </span>
                    </div>
                  )}
                </div>

                {/* Full snippet */}
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-700">
                  {highlightQuery(email.snippet)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show more indicator */}
      {totalCount && totalCount > results.length && (
        <p className="text-xs text-gray-500 text-center mt-2">
          Showing {results.length} of {totalCount} results
        </p>
      )}
    </div>
  );
}
