'use client';

import { useState } from 'react';

interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

interface AnswerPanelProps {
  query: string;
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  chunksUsed: number;
  keyPoints: string[];
  gaps: string[];
  onShowRawResults?: () => void;
  loading?: boolean;
}

export default function AnswerPanel({
  query,
  answer,
  citations,
  confidence,
  chunksUsed,
  keyPoints,
  gaps,
  onShowRawResults,
  loading = false,
}: AnswerPanelProps) {
  const [showCitations, setShowCitations] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(false);

  const confidenceStyles = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-red-100 text-red-700 border-red-200',
  };

  const confidenceIcons = {
    high: '✓',
    medium: '~',
    low: '!',
  };

  const priorityColors: Record<string, string> = {
    standard: 'bg-gray-100 text-gray-600',
    high: 'bg-yellow-100 text-yellow-700',
    authoritative: 'bg-green-100 text-green-700',
  };

  // Format answer with citations as clickable links
  const formatAnswerWithCitations = (text: string) => {
    // Replace [Source: filename, section] patterns with styled spans
    const parts = text.split(/(\[Source:[^\]]+\])/g);
    return parts.map((part, index) => {
      if (part.startsWith('[Source:')) {
        return (
          <span
            key={index}
            className="text-blue-600 text-sm cursor-help"
            title="Click citations below to view source"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
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
            <div>
              <div className="h-4 w-48 bg-gray-200 rounded"></div>
              <div className="h-3 w-32 bg-gray-100 rounded mt-1"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-100 rounded w-full"></div>
            <div className="h-4 bg-gray-100 rounded w-5/6"></div>
            <div className="h-4 bg-gray-100 rounded w-4/6"></div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Searching knowledge base and synthesizing answer...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Answer Card */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <span className="font-medium text-gray-900">AI Answer</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${confidenceStyles[confidence]}`}
                title={`Confidence: ${confidence}`}
              >
                {confidenceIcons[confidence]} {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
              </span>
              <span className="text-xs text-gray-500">
                {chunksUsed} source{chunksUsed !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Answer Content */}
        <div className="px-4 py-4">
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
            {formatAnswerWithCitations(answer)}
          </p>
        </div>

        {/* Gaps Warning (if any) */}
        {gaps.length > 0 && (
          <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <p className="text-sm font-medium text-yellow-700">Information gaps:</p>
                <ul className="text-sm text-yellow-600 mt-1 list-disc list-inside">
                  {gaps.map((gap, idx) => (
                    <li key={idx}>{gap}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Key Points (collapsible) */}
        {keyPoints.length > 0 && (
          <div className="border-t border-gray-100">
            <button
              onClick={() => setShowKeyPoints(!showKeyPoints)}
              className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span>📌</span>
                <span>Key Points ({keyPoints.length})</span>
              </span>
              <span>{showKeyPoints ? '▼' : '▶'}</span>
            </button>
            {showKeyPoints && (
              <div className="px-4 py-3 bg-gray-50">
                <ul className="space-y-2">
                  {keyPoints.map((point, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{formatAnswerWithCitations(point)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Citations (collapsible) */}
        {citations.length > 0 && (
          <div className="border-t border-gray-100">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span>📚</span>
                <span>Sources ({citations.length})</span>
              </span>
              <span>{showCitations ? '▼' : '▶'}</span>
            </button>
            {showCitations && (
              <div className="px-4 py-3 bg-gray-50 space-y-3">
                {citations.map((citation, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={citation.driveUrl || citation.sourceUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800 truncate"
                          >
                            {citation.fileName}
                          </a>
                          {citation.sectionTitle && (
                            <span className="text-xs text-gray-500">
                              › {citation.sectionTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {citation.excerpt}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-gray-500">
                          {Math.round(citation.similarity * 100)}% match
                        </span>
                        {citation.truthPriority && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
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

        {/* Footer Actions */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Answer generated from {chunksUsed} knowledge base chunks
          </span>
          {onShowRawResults && (
            <button
              onClick={onShowRawResults}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Show raw search results →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
