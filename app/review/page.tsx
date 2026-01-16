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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      setExpandedId(null);
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
      setExpandedId(null);
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
      setExpandedId(null);
      showToast('Follow-up approved', 'success');
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
      setExpandedId(null);
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

  // Filter items based on active tab
  const showTasks = activeTab === 'all' || activeTab === 'tasks';
  const showFollowUps = activeTab === 'all' || activeTab === 'follow-ups';

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
          <h1 className="text-2xl font-semibold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {counts.total} item{counts.total !== 1 ? 's' : ''} pending approval
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'tasks'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Tasks ({counts.task_suggestions})
          </button>
          <button
            onClick={() => setActiveTab('follow-ups')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'follow-ups'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Follow-ups ({counts.follow_up_suggestions})
          </button>
        </div>

        {/* Content */}
        {counts.total === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Task Suggestions */}
            {showTasks && suggestions.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-medium text-gray-500">Tasks</h2>
                    <span className="text-xs text-gray-400">{suggestions.length}</span>
                  </div>
                )}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {suggestions.map((suggestion) => {
                    const isExpanded = expandedId === `task-${suggestion.id}`;
                    const isProcessing = processingIds.has(suggestion.id);
                    const editedTitle = taskEdits[suggestion.id]?.title ?? suggestion.title;
                    const editedDueDate = taskEdits[suggestion.id]?.due_date ?? suggestion.suggested_due_date;
                    const editedPriority = taskEdits[suggestion.id]?.priority ?? suggestion.priority;

                    return (
                      <div key={suggestion.id}>
                        {/* Compact Row */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : `task-${suggestion.id}`)}
                        >
                          {/* Type Indicator */}
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />

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
                                  onChange={(e) => updateTaskEdit(suggestion.id, 'title', e.target.value)}
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
                                    onChange={(e) => updateTaskEdit(suggestion.id, 'due_date', e.target.value || null)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isProcessing}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                                  <select
                                    value={editedPriority}
                                    onChange={(e) => updateTaskEdit(suggestion.id, 'priority', e.target.value as 'low' | 'med' | 'high')}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApproveTask(suggestion); }}
                                disabled={isProcessing}
                                className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Approve'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRejectTask(suggestion.id); }}
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
              </div>
            )}

            {/* Follow-up Suggestions */}
            {showFollowUps && followUps.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-medium text-gray-500">Follow-ups</h2>
                    <span className="text-xs text-gray-400">{followUps.length}</span>
                  </div>
                )}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {followUps.map((followUp) => {
                    const isExpanded = expandedId === `followup-${followUp.id}`;
                    const isProcessing = processingIds.has(followUp.id);
                    const editedSubject = followUpEdits[followUp.id]?.subject ?? followUp.draft_subject;
                    const editedBody = followUpEdits[followUp.id]?.body ?? followUp.draft_body;

                    return (
                      <div key={followUp.id}>
                        {/* Compact Row */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : `followup-${followUp.id}`)}
                        >
                          {/* Type Indicator */}
                          <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />

                          {/* Title */}
                          <span className="flex-1 text-sm text-gray-900 truncate">
                            {followUp.thread.subject || 'No subject'}
                          </span>

                          {/* Waiting On */}
                          <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                            {followUp.thread.waiting_on_email?.split('@')[0]}
                          </span>

                          {/* Tone Badge */}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                            {followUp.tone}
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
                            {/* Thread Context */}
                            <div className="text-xs text-gray-500 mb-3">
                              <span className="font-medium">Waiting on:</span> {followUp.thread.waiting_on_email}
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-3 mb-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={editedSubject || ''}
                                  onChange={(e) => updateFollowUpEdit(followUp.id, 'subject', e.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  disabled={isProcessing}
                                  placeholder="Re: Original subject"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                                <textarea
                                  value={editedBody}
                                  onChange={(e) => updateFollowUpEdit(followUp.id, 'body', e.target.value)}
                                  rows={4}
                                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  disabled={isProcessing}
                                />
                              </div>

                              {followUp.ai_reasoning && (
                                <div className="text-xs text-gray-500 italic">
                                  <span className="font-medium not-italic">AI reasoning:</span> {followUp.ai_reasoning}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApproveFollowUp(followUp); }}
                                disabled={isProcessing}
                                className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Approve & Send'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRejectFollowUp(followUp.id); }}
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
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex gap-4">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Home
          </a>
          <a href="/tasks" className="text-sm text-blue-600 hover:text-blue-800">
            Tasks →
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
