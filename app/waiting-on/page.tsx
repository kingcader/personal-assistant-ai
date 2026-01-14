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

      // Remove from UI (optimistic update)
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

      // Remove from UI (optimistic update)
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
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
    // TODO: Navigate to follow-up generation or trigger API
    window.location.href = `/api/follow-ups/generate/${threadId}`;
  }

  function getDaysWaitingColor(days: number): string {
    if (days >= 7) return 'text-red-600 bg-red-50';
    if (days >= 4) return 'text-orange-600 bg-orange-50';
    return 'text-yellow-600 bg-yellow-50';
  }

  function formatLastMessage(preview: string | null): string {
    if (!preview) return 'No preview available';
    // Truncate to ~150 chars
    if (preview.length > 150) {
      return preview.substring(0, 150) + '...';
    }
    return preview;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading waiting-on threads...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-3xl font-bold">Waiting On</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Threads where you sent the last message and haven't received a reply
          </p>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
              {threads.length} thread{threads.length !== 1 ? 's' : ''} waiting
            </span>
          </div>
        </div>
      </div>

      {/* Threads List */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {threads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No threads waiting on replies. All caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => {
              const isProcessing = processingIds.has(thread.id);

              return (
                <div
                  key={thread.id}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Thread Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {thread.subject || 'No subject'}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Waiting on: </span>
                        <span className="font-medium text-foreground">
                          {thread.waiting_on_email}
                        </span>
                      </div>
                    </div>

                    {/* Days Waiting Badge */}
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${getDaysWaitingColor(
                        thread.days_waiting
                      )}`}
                    >
                      {thread.days_waiting} day{thread.days_waiting !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Last Message Preview */}
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {formatLastMessage(thread.last_message_preview)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() =>
                        setSnoozeModal({ threadId: thread.id, subject: thread.subject })
                      }
                      disabled={isProcessing}
                      className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      Snooze
                    </button>
                    <button
                      onClick={() => handleResolve(thread.id)}
                      disabled={isProcessing}
                      className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {isProcessing ? 'Processing...' : 'Resolve'}
                    </button>
                    <button
                      onClick={() => handleGenerateFollowUp(thread.id)}
                      disabled={isProcessing}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Generate Follow-up
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Snooze Modal */}
      {snoozeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Snooze Thread</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Snooze "{snoozeModal.subject || 'this thread'}" for:
            </p>

            <div className="mb-6 grid grid-cols-4 gap-2">
              {[1, 3, 5, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => setSnoozeDays(days)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    snoozeDays === days
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {days} day{days !== 1 ? 's' : ''}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSnoozeModal(null)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSnooze(snoozeModal.threadId, snoozeDays)}
                disabled={processingIds.has(snoozeModal.threadId)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {processingIds.has(snoozeModal.threadId) ? 'Snoozing...' : 'Snooze'}
              </button>
            </div>
          </div>
        </div>
      )}

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
