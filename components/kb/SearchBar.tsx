'use client';

import { useState, useCallback } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onClear: () => void;
  loading: boolean;
}

export default function SearchBar({
  value,
  onChange,
  onSearch,
  onClear,
  loading,
}: SearchBarProps) {
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (value.trim()) {
        onSearch(value.trim());
      }
    },
    [value, onSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClear();
      }
    },
    [onClear]
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {loading ? (
            <svg
              className="animate-spin h-5 w-5 text-gray-400"
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
          ) : (
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your knowledge base... (e.g., &quot;What does the agreement say about X?&quot;)"
          className="w-full pl-12 pr-24 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          disabled={loading}
        />

        {/* Buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
              title="Clear search"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={!value.trim() || loading}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>

      {/* Search Tips */}
      <div className="mt-2 text-xs text-gray-500">
        <span>Try: </span>
        <button
          type="button"
          onClick={() => {
            onChange('What are the key terms of the agreement?');
            onSearch('What are the key terms of the agreement?');
          }}
          className="text-blue-600 hover:text-blue-800 mr-3"
        >
          &quot;Key terms&quot;
        </button>
        <button
          type="button"
          onClick={() => {
            onChange('investor contacts');
            onSearch('investor contacts');
          }}
          className="text-blue-600 hover:text-blue-800 mr-3"
        >
          &quot;Investor contacts&quot;
        </button>
        <button
          type="button"
          onClick={() => {
            onChange('pricing and payment terms');
            onSearch('pricing and payment terms');
          }}
          className="text-blue-600 hover:text-blue-800"
        >
          &quot;Pricing&quot;
        </button>
      </div>
    </form>
  );
}
