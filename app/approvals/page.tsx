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

  function updateEdit(suggestionId: string, field: string, value: any) {
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

      // Remove from UI (optimistic update)
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      // Clear edits for this suggestion
      setEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[suggestion.id];
        return newEdits;
      });

      const ownerEmail = editedValues?.title
        ? suggestion.suggested_owner_email
        : suggestion.suggested_owner_email;
      showToast(`Task approved and assigned to ${ownerEmail}`, 'success');
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

      // Remove from UI (optimistic update)
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));

      // Clear edits for this suggestion
      setEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[suggestionId];
        return newEdits;
      });

      showToast('Suggestion rejected', 'success');
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      showToast('Failed to reject suggestion', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(suggestionId);
        return newSet;
      });
    }
  }

  function getPriorityColor(priority: 'low' | 'med' | 'high'): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'med':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading suggestions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-3xl font-bold">Task Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review AI-generated task suggestions from your emails
          </p>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-lg text-muted-foreground">No pending suggestions. All caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => {
              const editedTitle = edits[suggestion.id]?.title ?? suggestion.title;
              const editedDueDate = edits[suggestion.id]?.due_date ?? suggestion.suggested_due_date;
              const editedPriority = edits[suggestion.id]?.priority ?? suggestion.priority;
              const isProcessing = processingIds.has(suggestion.id);

              return (
                <div
                  key={suggestion.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Email Context */}
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {suggestion.email.subject}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        From {suggestion.email.sender.name || suggestion.email.sender.email} •{' '}
                        {formatRelativeTime(suggestion.email.received_at)}
                      </p>
                    </div>
                  </div>

                  {/* Task Details */}
                  <div className="space-y-4">
                    {/* Title (Editable) */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Task Title
                      </label>
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => updateEdit(suggestion.id, 'title', e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={isProcessing}
                      />
                    </div>

                    {/* Why (Read-only) */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Reason
                      </label>
                      <p className="text-sm text-muted-foreground italic">{suggestion.why}</p>
                    </div>

                    {/* Due Date & Priority (Editable) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={editedDueDate || ''}
                          onChange={(e) =>
                            updateEdit(suggestion.id, 'due_date', e.target.value || null)
                          }
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isProcessing}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Priority
                        </label>
                        <select
                          value={editedPriority}
                          onChange={(e) =>
                            updateEdit(
                              suggestion.id,
                              'priority',
                              e.target.value as 'low' | 'med' | 'high'
                            )
                          }
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isProcessing}
                        >
                          <option value="low">Low</option>
                          <option value="med">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    {/* Owner Email (Read-only for MVP) */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Assigned To
                      </label>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.suggested_owner_email}
                      </p>
                    </div>

                    {/* Priority Badge */}
                    <div>
                      <span
                        className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityColor(
                          editedPriority
                        )}`}
                      >
                        {editedPriority.toUpperCase()} PRIORITY
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => handleApprove(suggestion)}
                      disabled={isProcessing}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(suggestion.id)}
                      disabled={isProcessing}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-6 py-3 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
