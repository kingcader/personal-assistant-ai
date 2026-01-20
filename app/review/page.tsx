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

type ConfirmAction = {
  type: 'reject_task' | 'reject_followup';
  id: string;
  title: string;
};

type UndoAction = {
  type: 'reject_task' | 'reject_followup';
  id: string;
  data: PendingSuggestion | FollowUpWithThread;
  timeoutId: NodeJS.Timeout;
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; action?: { label: string; onClick: () => void } } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pendingUndo, setPendingUndo] = useState<UndoAction | null>(null);

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

  function showToast(message: string, type: 'success' | 'error', action?: { label: string; onClick: () => void }) {
    setToast({ message, type, action });
    if (!action) {
      setTimeout(() => setToast(null), 3000);
    } else {
      // Longer timeout for undo actions
      setTimeout(() => setToast(null), 5000);
    }
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

  function requestRejectTask(suggestion: PendingSuggestion) {
    setConfirmAction({
      type: 'reject_task',
      id: suggestion.id,
      title: suggestion.title,
    });
  }

  async function executeRejectTask(suggestionId: string) {
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    // Optimistically remove from UI
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setCounts((prev) => ({
      ...prev,
      task_suggestions: prev.task_suggestions - 1,
      total: prev.total - 1,
    }));
    setExpandedId(null);
    setConfirmAction(null);

    // Set up undo with delayed API call
    const timeoutId = setTimeout(async () => {
      setPendingUndo(null);
      try {
        await rejectSuggestion(suggestionId);
      } catch (error) {
        console.error('Failed to reject task:', error);
        // Restore on failure
        setSuggestions((prev) => [...prev, suggestion].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
        setCounts((prev) => ({
          ...prev,
          task_suggestions: prev.task_suggestions + 1,
          total: prev.total + 1,
        }));
        showToast('Failed to reject task', 'error');
      }
    }, 5000);

    setPendingUndo({
      type: 'reject_task',
      id: suggestionId,
      data: suggestion,
      timeoutId,
    });

    showToast('Task rejected', 'success', {
      label: 'Undo',
      onClick: () => undoRejectTask(suggestionId, suggestion, timeoutId),
    });
  }

  function undoRejectTask(suggestionId: string, suggestion: PendingSuggestion, timeoutId: NodeJS.Timeout) {
    clearTimeout(timeoutId);
    setPendingUndo(null);
    setToast(null);

    // Restore the suggestion
    setSuggestions((prev) => [...prev, suggestion].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setCounts((prev) => ({
      ...prev,
      task_suggestions: prev.task_suggestions + 1,
      total: prev.total + 1,
    }));
    showToast('Task restored', 'success');
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

  function requestRejectFollowUp(followUp: FollowUpWithThread) {
    setConfirmAction({
      type: 'reject_followup',
      id: followUp.id,
      title: followUp.thread.subject || 'Follow-up',
    });
  }

  async function executeRejectFollowUp(followUpId: string) {
    const followUp = followUps.find((f) => f.id === followUpId);
    if (!followUp) return;

    // Optimistically remove from UI
    setFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
    setCounts((prev) => ({
      ...prev,
      follow_up_suggestions: prev.follow_up_suggestions - 1,
      total: prev.total - 1,
    }));
    setExpandedId(null);
    setConfirmAction(null);

    // Set up undo with delayed API call
    const timeoutId = setTimeout(async () => {
      setPendingUndo(null);
      try {
        await rejectFollowUp(followUpId);
      } catch (error) {
        console.error('Failed to reject follow-up:', error);
        // Restore on failure
        setFollowUps((prev) => [...prev, followUp].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
        setCounts((prev) => ({
          ...prev,
          follow_up_suggestions: prev.follow_up_suggestions + 1,
          total: prev.total + 1,
        }));
        showToast('Failed to reject follow-up', 'error');
      }
    }, 5000);

    setPendingUndo({
      type: 'reject_followup',
      id: followUpId,
      data: followUp,
      timeoutId,
    });

    showToast('Follow-up rejected', 'success', {
      label: 'Undo',
      onClick: () => undoRejectFollowUp(followUpId, followUp, timeoutId),
    });
  }

  function undoRejectFollowUp(followUpId: string, followUp: FollowUpWithThread, timeoutId: NodeJS.Timeout) {
    clearTimeout(timeoutId);
    setPendingUndo(null);
    setToast(null);

    // Restore the follow-up
    setFollowUps((prev) => [...prev, followUp].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setCounts((prev) => ({
      ...prev,
      follow_up_suggestions: prev.follow_up_suggestions + 1,
      total: prev.total + 1,
    }));
    showToast('Follow-up restored', 'success');
  }

  function getPriorityDot(priority: 'low' | 'med' | 'high'): string {
    switch (priority) {
      case 'high': return 'bg-destructive';
      case 'med': return 'bg-warning';
      case 'low': return 'bg-primary';
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-3 w-64">
          <div className="h-4 bg-muted rounded-full w-3/4"></div>
          <div className="h-4 bg-muted rounded-full w-1/2"></div>
          <div className="h-4 bg-muted rounded-full w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Review Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} item{counts.total !== 1 ? 's' : ''} pending approval
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all active:scale-[0.97] ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all active:scale-[0.97] ${
              activeTab === 'tasks'
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            Tasks ({counts.task_suggestions})
          </button>
          <button
            onClick={() => setActiveTab('follow-ups')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all active:scale-[0.97] ${
              activeTab === 'follow-ups'
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            Follow-ups ({counts.follow_up_suggestions})
          </button>
        </div>

        {/* Content */}
        {counts.total === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Task Suggestions */}
            {showTasks && suggestions.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-medium text-muted-foreground">Tasks</h2>
                    <span className="text-xs text-muted-foreground">{suggestions.length}</span>
                  </div>
                )}
                <div className="card-ios p-0 divide-y divide-border">
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
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted"
                          onClick={() => setExpandedId(isExpanded ? null : `task-${suggestion.id}`)}
                        >
                          {/* Type Indicator */}
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />

                          {/* Priority Dot */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(suggestion.priority)}`} />

                          {/* Title */}
                          <span className="flex-1 text-sm truncate">
                            {suggestion.title}
                          </span>

                          {/* Source */}
                          <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                            {suggestion.email.sender.name || suggestion.email.sender.email.split('@')[0]}
                          </span>

                          {/* Time */}
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatRelativeTime(suggestion.email.received_at)}
                          </span>

                          {/* Chevron */}
                          <svg
                            className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                            {/* Email Context */}
                            <div className="text-xs text-muted-foreground mb-3">
                              <span className="font-medium">From email:</span> {suggestion.email.subject}
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-3 mb-4">
                              <div>
                                <label className="block text-xs font-medium mb-1">Task Title</label>
                                <input
                                  type="text"
                                  value={editedTitle}
                                  onChange={(e) => updateTaskEdit(suggestion.id, 'title', e.target.value)}
                                  className="input-ios"
                                  disabled={isProcessing}
                                />
                              </div>

                              <div className="text-xs text-muted-foreground italic">
                                <span className="font-medium not-italic">Why:</span> {suggestion.why}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Due Date</label>
                                  <input
                                    type="date"
                                    value={editedDueDate || ''}
                                    onChange={(e) => updateTaskEdit(suggestion.id, 'due_date', e.target.value || null)}
                                    className="input-ios"
                                    disabled={isProcessing}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Priority</label>
                                  <select
                                    value={editedPriority}
                                    onChange={(e) => updateTaskEdit(suggestion.id, 'priority', e.target.value as 'low' | 'med' | 'high')}
                                    className="input-ios"
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
                                className="text-xs px-4 py-1.5 rounded-xl font-medium bg-success text-success-foreground active:scale-[0.97] disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Approve'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); requestRejectTask(suggestion); }}
                                disabled={isProcessing}
                                className="text-xs px-4 py-1.5 rounded-xl font-medium bg-destructive text-destructive-foreground active:scale-[0.97] disabled:opacity-50"
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
                    <h2 className="text-sm font-medium text-muted-foreground">Follow-ups</h2>
                    <span className="text-xs text-muted-foreground">{followUps.length}</span>
                  </div>
                )}
                <div className="card-ios p-0 divide-y divide-border">
                  {followUps.map((followUp) => {
                    const isExpanded = expandedId === `followup-${followUp.id}`;
                    const isProcessing = processingIds.has(followUp.id);
                    const editedSubject = followUpEdits[followUp.id]?.subject ?? followUp.draft_subject;
                    const editedBody = followUpEdits[followUp.id]?.body ?? followUp.draft_body;

                    return (
                      <div key={followUp.id}>
                        {/* Compact Row */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted"
                          onClick={() => setExpandedId(isExpanded ? null : `followup-${followUp.id}`)}
                        >
                          {/* Type Indicator */}
                          <div className="w-2 h-2 rounded-full bg-chart-5 flex-shrink-0" />

                          {/* Title */}
                          <span className="flex-1 text-sm truncate">
                            {followUp.thread.subject || 'No subject'}
                          </span>

                          {/* Waiting On */}
                          <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                            {followUp.thread.waiting_on_email?.split('@')[0]}
                          </span>

                          {/* Tone Badge */}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                            {followUp.tone}
                          </span>

                          {/* Chevron */}
                          <svg
                            className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                            {/* Thread Context */}
                            <div className="text-xs text-muted-foreground mb-3">
                              <span className="font-medium">Waiting on:</span> {followUp.thread.waiting_on_email}
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-3 mb-4">
                              <div>
                                <label className="block text-xs font-medium mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={editedSubject || ''}
                                  onChange={(e) => updateFollowUpEdit(followUp.id, 'subject', e.target.value)}
                                  className="input-ios"
                                  disabled={isProcessing}
                                  placeholder="Re: Original subject"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium mb-1">Message</label>
                                <textarea
                                  value={editedBody}
                                  onChange={(e) => updateFollowUpEdit(followUp.id, 'body', e.target.value)}
                                  rows={4}
                                  className="input-ios min-h-[100px] resize-none"
                                  disabled={isProcessing}
                                />
                              </div>

                              {followUp.ai_reasoning && (
                                <div className="text-xs text-muted-foreground italic">
                                  <span className="font-medium not-italic">AI reasoning:</span> {followUp.ai_reasoning}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApproveFollowUp(followUp); }}
                                disabled={isProcessing}
                                className="text-xs px-4 py-1.5 rounded-xl font-medium bg-success text-success-foreground active:scale-[0.97] disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Approve & Send'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); requestRejectFollowUp(followUp); }}
                                disabled={isProcessing}
                                className="text-xs px-4 py-1.5 rounded-xl font-medium bg-destructive text-destructive-foreground active:scale-[0.97] disabled:opacity-50"
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

      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-ios max-w-sm w-full overflow-hidden">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">
                Confirm Rejection
              </h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to reject "{confirmAction.title}"?
              </p>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 bg-muted/30 border-t">
              <button
                onClick={() => setConfirmAction(null)}
                className="btn-ios-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'reject_task') {
                    executeRejectTask(confirmAction.id);
                  } else {
                    executeRejectFollowUp(confirmAction.id);
                  }
                }}
                className="px-4 py-2.5 rounded-xl font-medium bg-destructive text-destructive-foreground active:scale-[0.97]"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast with Undo */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
          <div className={`rounded-xl px-4 py-3 shadow-lg text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
          }`}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                }}
                className="px-2 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
