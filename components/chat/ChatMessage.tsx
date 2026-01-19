'use client';

import { useState } from 'react';
import EmailSearchResults from './EmailSearchResults';

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

interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  type?: 'answer' | 'draft' | 'agenda' | 'info' | 'general' | 'search_results';
  citations?: Citation[];
  confidence?: 'high' | 'medium' | 'low';
  isLoading?: boolean;
  action?: {
    type: string;
    status: string;
    data: Record<string, unknown>;
  };
  searchResults?: EmailResult[];
  onApproveAction?: () => void;
  onEditAction?: () => void;
  onCancelAction?: () => void;
}

export default function ChatMessage({
  role,
  content,
  timestamp,
  type,
  citations,
  confidence,
  isLoading = false,
  action,
  searchResults,
  onApproveAction,
  onEditAction,
  onCancelAction,
}: ChatMessageProps) {
  const [showCitations, setShowCitations] = useState(false);

  const confidenceStyles = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700',
  };

  const priorityColors: Record<string, string> = {
    standard: 'bg-gray-100 text-gray-600',
    high: 'bg-yellow-100 text-yellow-700',
    authoritative: 'bg-green-100 text-green-700',
  };

  // Format content with markdown-like styling
  const formatContent = (text: string) => {
    // Split by double newlines for paragraphs
    const paragraphs = text.split(/\n\n+/);

    return paragraphs.map((paragraph, pIdx) => {
      // Check if it's a list item
      if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
        const items = paragraph.split(/\n/).filter(Boolean);
        return (
          <ul key={pIdx} className="list-disc list-inside space-y-1 my-2">
            {items.map((item, iIdx) => (
              <li key={iIdx} className="text-sm">
                {formatInline(item.replace(/^[-*]\s+/, ''))}
              </li>
            ))}
          </ul>
        );
      }

      // Check for headers
      if (paragraph.startsWith('**') && paragraph.includes('**:')) {
        return (
          <p key={pIdx} className="text-sm font-medium my-2">
            {formatInline(paragraph)}
          </p>
        );
      }

      // Regular paragraph
      return (
        <p key={pIdx} className="text-sm my-1">
          {formatInline(paragraph)}
        </p>
      );
    });
  };

  // Format inline elements (bold, citations)
  const formatInline = (text: string) => {
    // Handle bold (**text**)
    const parts = text.split(/(\*\*[^*]+\*\*|\[Source:[^\]]+\])/g);

    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('[Source:')) {
        return (
          <span
            key={idx}
            className="text-blue-600 text-xs cursor-help"
            title="Source citation"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
          <svg
            className="animate-spin h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Thinking...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 p-4 ${
        role === 'user' ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          role === 'user'
            ? 'bg-gray-700 text-white'
            : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
        }`}
      >
        {role === 'user' ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">
            {role === 'user' ? 'You' : 'Assistant'}
          </span>
          {confidence && role === 'assistant' && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${confidenceStyles[confidence]}`}
            >
              {confidence}
            </span>
          )}
          {type && role === 'assistant' && type !== 'general' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
              {type}
            </span>
          )}
          {timestamp && (
            <span className="text-xs text-gray-400">
              {timestamp.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="text-gray-800">
          {formatContent(content)}
        </div>

        {/* Action buttons for drafts */}
        {action && action.type === 'send_email' && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <button
              onClick={onApproveAction}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve & Send
            </button>
            <button
              onClick={onEditAction}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={onCancelAction}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Email search results */}
        {searchResults && searchResults.length > 0 && (
          <EmailSearchResults
            results={searchResults}
            totalCount={searchResults.length}
          />
        )}

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>{citations.length} source{citations.length !== 1 ? 's' : ''}</span>
              <svg
                className={`w-3 h-3 transition-transform ${showCitations ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {showCitations && (
              <div className="mt-2 space-y-2">
                {citations.map((citation, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50 rounded border border-gray-200 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={citation.driveUrl || citation.sourceUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline truncate block"
                        >
                          {citation.fileName}
                        </a>
                        {citation.sectionTitle && (
                          <span className="text-xs text-gray-500">
                            {citation.sectionTitle}
                          </span>
                        )}
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {citation.excerpt}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-500">
                          {Math.round(citation.similarity * 100)}%
                        </span>
                        {citation.truthPriority && (
                          <span
                            className={`text-xs px-1 py-0.5 rounded ${
                              priorityColors[citation.truthPriority] || priorityColors.standard
                            }`}
                          >
                            {citation.truthPriority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
