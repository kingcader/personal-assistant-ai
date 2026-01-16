'use client';

import { useEffect, useState } from 'react';
import {
  getWaitingOnThreads,
  snoozeThread,
  resolveThread,
} from '@/lib/supabase/thread-queries';
import type { WaitingOnThread } from '@/types/database';

type SnoozeModalState = {
  threadId: string;
  subject: string | null;
} | null;

export default function WaitingOnPage() {
  const [threads, setThreads] = useState<WaitingOnThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [snoozeModal, setSnoozeModal] = useState<SnoozeModalState>(null);
  const [snoozeDays, setSnoozeDays] = useState(3);

  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    try {
      const data = await getWaitingOnThreads();
      setThreads(data);
    } catch (error) {
      console.error('Failed to load waiting-on threads:', error);
      showToast('Failed to load threads', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSnooze(threadId: string, days: number) {
    if (processingIds.has(threadId)) return;

    setProcessingIds((prev) => new Set(prev).add(threadId));

    try {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + days);

      await snoozeThread(threadId, snoozeUntil.toISOString());

      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setSnoozeModal(null);
      showToast(`Snoozed for ${days} days`, 'success');
    } catch (error) {
      console.error('Failed to snooze thread:', error);
      showToast('Failed to snooze thread', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(threadId);
        return newSet;
      });
    }
  }

  async function handleResolve(threadId: string) {
    if (processingIds.has(threadId)) return;

    setProcessingIds((prev) => new Set(prev).add(threadId));

    try {
      await resolveThread(threadId, 'manual');

      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setExpandedId(null);
      showToast('Thread resolved', 'success');
    } catch (error) {
      console.error('Failed to resolve thread:', error);
      showToast('Failed to resolve thread', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(threadId);
        return newSet;
      });
    }
  }

  function handleGenerateFollowUp(threadId: string) {
    window.location.href = `/api/follow-ups/generate/${threadId}`;
  }

  function getDaysWaitingColor(days: number): string {
    if (days >= 7) return 'text-red-600';
    if (days >= 4) return 'text-orange-500';
    return 'text-yellow-600';
  }

  function getDaysWaitingBg(days: number): string {
    if (days >= 7) return 'bg-red-50';
    if (days >= 4) return 'bg-orange-50';
    return 'bg-yellow-50';
  }

  function formatLastMessage(preview: string | null): string {
    if (!preview) return 'No preview available';
    if (preview.length > 200) {
      return preview.substring(0, 200) + '...';
    }
    return preview;
  }

  // Group threads by urgency
  function groupThreads(threads: WaitingOnThread[]) {
    const urgent = threads.filter(t => t.days_waiting >= 7);
    const moderate = threads.filter(t => t.days_waiting >= 4 && t.days_waiting < 7);
    const recent = threads.filter(t => t.days_waiting < 4);

    const groups = [];
    if (urgent.length > 0) groups.push({ key: 'urgent', label: 'Urgent (7+ days)', threads: urgent });
    if (moderate.length > 0) groups.push({ key: 'moderate', label: 'Needs Attention (4-6 days)', threads: moderate });
    if (recent.length > 0) groups.push({ key: 'recent', label: 'Recent (2-3 days)', threads: recent });

    return groups;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const groupedThreads = groupThreads(threads);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Waiting On</h1>
          <p className="text-sm text-gray-500 mt-1">
            {threads.length} thread{threads.length !== 1 ? 's' : ''} awaiting reply
          </p>
        </div>

        {/* Thread List */}
        {threads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">All caught up! No threads waiting.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedThreads.map((group) => (
              <div key={group.key}>
                {/* Group Header */}
                <div className="flex items-center gap-2 mb-2">
                  <h2 className={`text-sm font-medium ${
                    group.key === 'urgent' ? 'text-red-600' :
                    group.key === 'moderate' ? 'text-orange-600' : 'text-gray-500'
                  }`}>
                    {group.label}
                  </h2>
                  <span className="text-xs text-gray-400">{group.threads.length}</span>
                </div>

                {/* Thread Rows */}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {group.threads.map((thread) => {
                    const isExpanded = expandedId === thread.id;
                    const isProcessing = processingIds.has(thread.id);

                    return (
                      <div key={thread.id}>
                        {/* Compact Row */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : thread.id)}
                        >
                          {/* Days Waiting */}
                          <div className={`text-xs font-medium px-2 py-1 rounded ${getDaysWaitingBg(thread.days_waiting)} ${getDaysWaitingColor(thread.days_waiting)}`}>
                            {thread.days_waiting}d
                          </div>

                          {/* Subject */}
                          <span className="flex-1 text-sm text-gray-900 truncate">
                            {thread.subject || 'No subject'}
                          </span>

                          {/* Waiting On */}
                          <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                            {thread.waiting_on_email?.split('@')[0]}
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
                            {/* Waiting On */}
                            <div className="text-xs text-gray-500 mb-3">
                              <span className="font-medium">Waiting on:</span> {thread.waiting_on_email}
                            </div>

                            {/* Last Message Preview */}
                            {thread.last_message_preview && (
                              <div className="mb-4 p-3 bg-white rounded border border-gray-200">
                                <p className="text-sm text-gray-600">
                                  {formatLastMessage(thread.last_message_preview)}
                                </p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateFollowUp(thread.id);
                                }}
                                disabled={isProcessing}
                                className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                Generate Follow-up
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSnoozeModal({ threadId: thread.id, subject: thread.subject });
                                }}
                                disabled={isProcessing}
                                className="text-xs px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                              >
                                Snooze
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolve(thread.id);
                                }}
                                disabled={isProcessing}
                                className="text-xs px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Resolve'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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

      {/* Snooze Modal */}
      {snoozeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Snooze Thread</h2>
            <p className="text-sm text-gray-500 mb-4">
              Snooze for how long?
            </p>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1, 3, 5, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => setSnoozeDays(days)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    snoozeDays === days
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSnoozeModal(null)}
                className="text-sm px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSnooze(snoozeModal.threadId, snoozeDays)}
                disabled={processingIds.has(snoozeModal.threadId)}
                className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {processingIds.has(snoozeModal.threadId) ? '...' : 'Snooze'}
              </button>
            </div>
          </div>
        </div>
      )}

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
