'use client';

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

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  error: string | null;
}

export default function SearchResults({
  results,
  query,
  error,
}: SearchResultsProps) {
  const priorityColors: Record<string, string> = {
    standard: 'bg-gray-100 text-gray-600',
    high: 'bg-yellow-100 text-yellow-700',
    authoritative: 'bg-green-100 text-green-700',
  };

  const priorityLabels: Record<string, string> = {
    standard: 'Standard',
    high: 'High',
    authoritative: 'Authoritative',
  };

  // Highlight matching terms in content
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;

    const words = searchQuery.toLowerCase().split(/\s+/);
    let highlighted = text;

    // Create a pattern that matches any of the search words
    const pattern = new RegExp(
      `(${words.filter(w => w.length > 2).join('|')})`,
      'gi'
    );

    highlighted = text.replace(
      pattern,
      '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>'
    );

    return highlighted;
  };

  // Format similarity as percentage
  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}% match`;
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">🔍</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No results found
        </h3>
        <p className="text-gray-500">
          No documents match &quot;{query}&quot;
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Try different keywords or check if the relevant documents are indexed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
        </h2>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={result.chunkId}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
          >
            {/* Result Header */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  #{index + 1}
                </span>
                <a
                  href={result.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate max-w-md"
                >
                  {result.fileName}
                </a>
                {result.sectionTitle && (
                  <span className="text-sm text-gray-400">
                    &gt; {result.sectionTitle}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {result.truthPriority && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      priorityColors[result.truthPriority] || priorityColors.standard
                    }`}
                  >
                    {priorityLabels[result.truthPriority] || result.truthPriority}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {formatSimilarity(result.similarity)}
                </span>
              </div>
            </div>

            {/* Result Content */}
            <div className="px-4 py-3">
              <p
                className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: highlightText(result.content, query),
                }}
              />
            </div>

            {/* Result Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {result.documentPath || 'Root folder'}
              </span>
              <a
                href={result.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Open in Drive →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Results Footer */}
      {results.length >= 10 && (
        <div className="text-center text-sm text-gray-500 py-4">
          Showing top {results.length} results. Refine your search for more specific results.
        </div>
      )}
    </div>
  );
}
