'use client';

import { useEffect, useState } from 'react';
import {
  getPendingSuggestions,
  approveSuggestion,
  rejectSuggestion,
  type PendingSuggestion,
} from '@/lib/supabase/task-queries';
import {
  getPendingFollowUps,
  approveFollowUp,
  rejectFollowUp,
  type FollowUpWithThread,
} from '@/lib/supabase/thread-queries';
import { getPendingApprovalsCount } from '@/lib/supabase/audit-queries';
import type { PendingApprovalsCount } from '@/types/database';

type Tab = 'all' | 'tasks' | 'follow-ups';

type TaskEditState = {
  [key: string]: {
    title?: string;
    due_date?: string | null;
    priority?: 'low' | 'med' | 'high';
  };
};

type FollowUpEditState = {
  [key: string]: {
    subject?: string;
    body?: string;
  };
};

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpWithThread[]>([]);
  const [counts, setCounts] = useState<PendingApprovalsCount>({
    task_suggestions: 0,
    follow_up_suggestions: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [taskEdits, setTaskEdits] = useState<TaskEditState>({});
  const [followUpEdits, setFollowUpEdits] = useState<FollowUpEditState>({});
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [suggestionsData, followUpsData, countsData] = await Promise.all([
        getPendingSuggestions(),
        getPendingFollowUps(),
        getPendingApprovalsCount(),
      ]);
      setSuggestions(suggestionsData);
      setFollowUps(followUpsData);
      setCounts(countsData);
    } catch (error) {
      console.error('Failed to load review data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Task suggestion handlers
  function updateTaskEdit(suggestionId: string, field: string, value: unknown) {
    setTaskEdits((prev) => ({
      ...prev,
      [suggestionId]: {
        ...prev[suggestionId],
        [field]: value,
      },
    }));
  }

  async function handleApproveTask(suggestion: PendingSuggestion) {
    if (processingIds.has(suggestion.id)) return;
    setProcessingIds((prev) => new Set(prev).add(suggestion.id));

    try {
      const editedValues = taskEdits[suggestion.id];
      await approveSuggestion(suggestion.id, editedValues);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      setTaskEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[suggestion.id];
        return newEdits;
      });
      setCounts((prev) => ({
        ...prev,
        task_suggestions: prev.task_suggestions - 1,
        total: prev.total - 1,
      }));
      showToast('Task approved', 'success');
    } catch (error) {
      console.error('Failed to approve task:', error);
      showToast('Failed to approve task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(suggestion.id);
        return newSet;
      });
    }
  }

  async function handleRejectTask(suggestionId: string) {
    if (processingIds.has(suggestionId)) return;
    setProcessingIds((prev) => new Set(prev).add(suggestionId));

    try {
      await rejectSuggestion(suggestionId);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      setTaskEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[suggestionId];
        return newEdits;
      });
      setCounts((prev) => ({
        ...prev,
        task_suggestions: prev.task_suggestions - 1,
        total: prev.total - 1,
      }));
      showToast('Task rejected', 'success');
    } catch (error) {
      console.error('Failed to reject task:', error);
      showToast('Failed to reject task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(suggestionId);
        return newSet;
      });
    }
  }

  // Follow-up handlers
  function updateFollowUpEdit(followUpId: string, field: string, value: unknown) {
    setFollowUpEdits((prev) => ({
      ...prev,
      [followUpId]: {
        ...prev[followUpId],
        [field]: value,
      },
    }));
  }

  async function handleApproveFollowUp(followUp: FollowUpWithThread) {
    if (processingIds.has(followUp.id)) return;
    setProcessingIds((prev) => new Set(prev).add(followUp.id));

    try {
      const editedValues = followUpEdits[followUp.id];
      await approveFollowUp(followUp.id, editedValues);
      setFollowUps((prev) => prev.filter((f) => f.id !== followUp.id));
      setFollowUpEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[followUp.id];
        return newEdits;
      });
      setCounts((prev) => ({
        ...prev,
        follow_up_suggestions: prev.follow_up_suggestions - 1,
        total: prev.total - 1,
      }));
      showToast('Follow-up approved - ready to send', 'success');
    } catch (error) {
      console.error('Failed to approve follow-up:', error);
      showToast('Failed to approve follow-up', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(followUp.id);
        return newSet;
      });
    }
  }

  async function handleRejectFollowUp(followUpId: string) {
    if (processingIds.has(followUpId)) return;
    setProcessingIds((prev) => new Set(prev).add(followUpId));

    try {
      await rejectFollowUp(followUpId);
      setFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
      setFollowUpEdits((prev) => {
        const newEdits = { ...prev };
        delete newEdits[followUpId];
        return newEdits;
      });
      setCounts((prev) => ({
        ...prev,
        follow_up_suggestions: prev.follow_up_suggestions - 1,
        total: prev.total - 1,
      }));
      showToast('Follow-up rejected', 'success');
    } catch (error) {
      console.error('Failed to reject follow-up:', error);
      showToast('Failed to reject follow-up', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(followUpId);
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

  // Filter items based on active tab
  const showTasks = activeTab === 'all' || activeTab === 'tasks';
  const showFollowUps = activeTab === 'all' || activeTab === 'follow-ups';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading review queue...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your command center for all pending approvals
          </p>

          {/* Tab Navigation */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All ({counts.total})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              Tasks ({counts.task_suggestions})
            </button>
            <button
              onClick={() => setActiveTab('follow-ups')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'follow-ups'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
              }`}
            >
              Follow-ups ({counts.follow_up_suggestions})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {counts.total === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No pending approvals. All caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Task Suggestions Section */}
            {showTasks && suggestions.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <span className="inline-block h-3 w-3 rounded-full bg-blue-500"></span>
                    Task Suggestions
                  </h2>
                )}
                <div className="space-y-4">
                  {suggestions.map((suggestion) => {
                    const editedTitle = taskEdits[suggestion.id]?.title ?? suggestion.title;
                    const editedDueDate =
                      taskEdits[suggestion.id]?.due_date ?? suggestion.suggested_due_date;
                    const editedPriority =
                      taskEdits[suggestion.id]?.priority ?? suggestion.priority;
                    const isProcessing = processingIds.has(suggestion.id);

                    return (
                      <div
                        key={suggestion.id}
                        className="rounded-lg border border-blue-200 bg-card p-6 shadow-sm"
                      >
                        {/* Email Context */}
                        <div className="mb-4 flex items-start justify-between">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                TASK
                              </span>
                            </div>
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
                          <div>
                            <label className="mb-1 block text-sm font-medium">Task Title</label>
                            <input
                              type="text"
                              value={editedTitle}
                              onChange={(e) =>
                                updateTaskEdit(suggestion.id, 'title', e.target.value)
                              }
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              disabled={isProcessing}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">Reason</label>
                            <p className="text-sm text-muted-foreground italic">{suggestion.why}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="mb-1 block text-sm font-medium">Due Date</label>
                              <input
                                type="date"
                                value={editedDueDate || ''}
                                onChange={(e) =>
                                  updateTaskEdit(
                                    suggestion.id,
                                    'due_date',
                                    e.target.value || null
                                  )
                                }
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                disabled={isProcessing}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium">Priority</label>
                              <select
                                value={editedPriority}
                                onChange={(e) =>
                                  updateTaskEdit(
                                    suggestion.id,
                                    'priority',
                                    e.target.value as 'low' | 'med' | 'high'
                                  )
                                }
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                disabled={isProcessing}
                              >
                                <option value="low">Low</option>
                                <option value="med">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={() => handleApproveTask(suggestion)}
                            disabled={isProcessing}
                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {isProcessing ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleRejectTask(suggestion.id)}
                            disabled={isProcessing}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Follow-up Suggestions Section */}
            {showFollowUps && followUps.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <span className="inline-block h-3 w-3 rounded-full bg-purple-500"></span>
                    Follow-up Suggestions
                  </h2>
                )}
                <div className="space-y-4">
                  {followUps.map((followUp) => {
                    const editedSubject =
                      followUpEdits[followUp.id]?.subject ?? followUp.draft_subject;
                    const editedBody = followUpEdits[followUp.id]?.body ?? followUp.draft_body;
                    const isProcessing = processingIds.has(followUp.id);

                    return (
                      <div
                        key={followUp.id}
                        className="rounded-lg border border-purple-200 bg-card p-6 shadow-sm"
                      >
                        {/* Thread Context */}
                        <div className="mb-4">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                              FOLLOW-UP
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {followUp.tone} tone
                            </span>
                          </div>
                          <h3 className="font-semibold text-foreground">
                            {followUp.thread.subject || 'No subject'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Waiting on: {followUp.thread.waiting_on_email}
                          </p>
                        </div>

                        {/* Draft Content */}
                        <div className="space-y-4">
                          <div>
                            <label className="mb-1 block text-sm font-medium">Subject</label>
                            <input
                              type="text"
                              value={editedSubject || ''}
                              onChange={(e) =>
                                updateFollowUpEdit(followUp.id, 'subject', e.target.value)
                              }
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              disabled={isProcessing}
                              placeholder="Re: Original subject"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">Message</label>
                            <textarea
                              value={editedBody}
                              onChange={(e) =>
                                updateFollowUpEdit(followUp.id, 'body', e.target.value)
                              }
                              rows={5}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              disabled={isProcessing}
                            />
                          </div>

                          {followUp.ai_reasoning && (
                            <div>
                              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                AI Reasoning
                              </label>
                              <p className="text-sm text-muted-foreground italic">
                                {followUp.ai_reasoning}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={() => handleApproveFollowUp(followUp)}
                            disabled={isProcessing}
                            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {isProcessing ? 'Processing...' : 'Approve & Queue to Send'}
                          </button>
                          <button
                            onClick={() => handleRejectFollowUp(followUp.id)}
                            disabled={isProcessing}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-6 py-3 shadow-lg ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
