'use client';

import { useEffect, useState } from 'react';
import { getTasksByOwner } from '@/lib/supabase/task-queries';

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  owner: {
    name: string | null;
    email: string;
  };
  email: {
    subject: string;
    received_at: string;
  };
};

type SortOption = 'due_date' | 'priority' | 'status' | 'created_at';

const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };
const STATUS_ORDER = { in_progress: 0, todo: 1, completed: 2, cancelled: 3 };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('due_date');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadTasks();
  }, [includeCompleted]);

  async function loadTasks() {
    try {
      const data = await getTasksByOwner('kincaidgarrett@gmail.com', includeCompleted);
      setTasks(data as unknown as Task[]);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function updateTaskStatus(taskId: string, newStatus: Task['status']) {
    if (processingIds.has(taskId)) return;

    setProcessingIds((prev) => new Set(prev).add(taskId));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      const { task: updatedTask } = await response.json();

      // Update task in state
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t))
      );

      const statusLabel = newStatus === 'in_progress' ? 'started' : newStatus;
      showToast(`Task ${statusLabel}`, 'success');

      // If task is completed and we're not showing completed, remove from view
      if (newStatus === 'completed' && !includeCompleted) {
        setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        }, 500);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  }

  function sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          // Null dates go last
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'med':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  const sortedTasks = sortTasks(tasks);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h1>
          <p className="text-gray-600">
            Tasks created from approved email suggestions
          </p>
        </div>

        {/* Filter & Sort Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeCompleted"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="includeCompleted" className="text-sm text-gray-700">
              Show completed tasks
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sortBy" className="text-sm text-gray-700">
              Sort by:
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="created_at">Created</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        {sortedTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">
              {includeCompleted
                ? 'No tasks found'
                : 'No active tasks. All caught up!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedTasks.map((task) => {
              const isProcessing = processingIds.has(task.id);

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 ${
                    task.status === 'completed' ? 'opacity-75' : ''
                  }`}
                >
                  {/* Task Header */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className={`text-lg font-semibold text-gray-900 ${
                      task.status === 'completed' ? 'line-through' : ''
                    }`}>
                      {task.title}
                    </h3>
                    <div className="flex gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(
                          task.priority
                        )}`}
                      >
                        {task.priority.toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {task.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Task Description */}
                  {task.description && (
                    <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                  )}

                  {/* Task Meta */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Due:</span>
                      <span>{formatDate(task.due_date)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">From:</span>
                      <span>{task.email.subject}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {/* Start button - visible when todo */}
                    {task.status === 'todo' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'in_progress')}
                        disabled={isProcessing}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {isProcessing ? '...' : 'Start'}
                      </button>
                    )}

                    {/* Complete button - visible when todo or in_progress */}
                    {(task.status === 'todo' || task.status === 'in_progress') && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        disabled={isProcessing}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {isProcessing ? '...' : 'Complete'}
                      </button>
                    )}

                    {/* Reopen button - visible when completed */}
                    {task.status === 'completed' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'todo')}
                        disabled={isProcessing}
                        className="rounded-md bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                      >
                        {isProcessing ? '...' : 'Reopen'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation Links */}
        <div className="mt-8 flex gap-4">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Home
          </a>
          <a
            href="/approvals"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Approvals →
          </a>
        </div>
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
