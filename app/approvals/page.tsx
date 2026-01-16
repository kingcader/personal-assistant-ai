'use client';

import { useEffect, useState } from 'react';
import {
  getPendingSuggestions,
  approveSuggestion,
  rejectSuggestion,
  type PendingSuggestion,
} from '@/lib/supabase/task-queries';

type EditState = {
  [key: string]: {
    title?: string;
    due_date?: string | null;
    priority?: 'low' | 'med' | 'high';
  };
};

export default function ApprovalsPage() {
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<EditState>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    try {
      const data = await getPendingSuggestions();
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      showToast('Failed to load suggestions', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function updateEdit(suggestionId: string, field: string, value: unknown) {
    setEdits((prev) => ({
      ...prev,
      [suggestionId]: {
        ...prev[suggestionId],
        [field]: value,
      },
    }));
  }

  async function handleApprove(suggestion: PendingSuggestion) {
    if (processingIds.has(suggestion.id)) return;

    setProcessingIds((prev) => new Set(prev).add(suggestion.id));

    try {
      const editedValues = edits[suggestion.id];
      await approveSuggestion(suggestion.id, editedValues);

      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      setEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[suggestion.id];
        return newEdits;
      });
      setExpandedId(null);
      showToast('Task approved', 'success');
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
      showToast('Failed to approve task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(suggestion.id);
        return newSet;
      });
    }
  }

  async function handleReject(suggestionId: string) {
    if (processingIds.has(suggestionId)) return;

    setProcessingIds((prev) => new Set(prev).add(suggestionId));

    try {
      await rejectSuggestion(suggestionId);

      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      setEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[suggestionId];
        return newEdits;
      });
      setExpandedId(null);
      showToast('Task rejected', 'success');
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      showToast('Failed to reject task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(suggestionId);
        return newSet;
      });
    }
  }

  function getPriorityDot(priority: 'low' | 'med' | 'high'): string {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'med': return 'bg-yellow-500';
      case 'low': return 'bg-blue-400';
    }
  }

  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Task Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} pending
          </p>
        </div>

        {/* Suggestions List */}
        {suggestions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">All caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {suggestions.map((suggestion) => {
              const isExpanded = expandedId === suggestion.id;
              const isProcessing = processingIds.has(suggestion.id);
              const editedTitle = edits[suggestion.id]?.title ?? suggestion.title;
              const editedDueDate = edits[suggestion.id]?.due_date ?? suggestion.suggested_due_date;
              const editedPriority = edits[suggestion.id]?.priority ?? suggestion.priority;

              return (
                <div key={suggestion.id}>
                  {/* Compact Row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                  >
                    {/* Priority Dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(suggestion.priority)}`} />

                    {/* Title */}
                    <span className="flex-1 text-sm text-gray-900 truncate">
                      {suggestion.title}
                    </span>

                    {/* Source */}
                    <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                      {suggestion.email.sender.name || suggestion.email.sender.email.split('@')[0]}
                    </span>

                    {/* Time */}
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatRelativeTime(suggestion.email.received_at)}
                    </span>

                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                      {/* Email Context */}
                      <div className="text-xs text-gray-500 mb-3">
                        <span className="font-medium">From email:</span> {suggestion.email.subject}
                      </div>

                      {/* Editable Fields */}
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Task Title</label>
                          <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => updateEdit(suggestion.id, 'title', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isProcessing}
                          />
                        </div>

                        <div className="text-xs text-gray-500 italic">
                          <span className="font-medium not-italic">Why:</span> {suggestion.why}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                            <input
                              type="date"
                              value={editedDueDate || ''}
                              onChange={(e) => updateEdit(suggestion.id, 'due_date', e.target.value || null)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isProcessing}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                            <select
                              value={editedPriority}
                              onChange={(e) => updateEdit(suggestion.id, 'priority', e.target.value as 'low' | 'med' | 'high')}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isProcessing}
                            >
                              <option value="low">Low</option>
                              <option value="med">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Assigned to:</span> {suggestion.suggested_owner_email}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(suggestion); }}
                          disabled={isProcessing}
                          className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {isProcessing ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReject(suggestion.id); }}
                          disabled={isProcessing}
                          className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex gap-4">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Home
          </a>
          <a href="/review" className="text-sm text-blue-600 hover:text-blue-800">
            Review Queue →
          </a>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`rounded-lg px-4 py-2 shadow-lg text-sm ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
