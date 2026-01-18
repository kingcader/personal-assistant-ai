'use client';

import { useEffect, useState } from 'react';
import { getTasksByOwner } from '@/lib/supabase/task-queries';
import CreateTaskModal from '@/components/calendar/CreateTaskModal';

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

type DateGroup = {
  key: string;
  label: string;
  tasks: Task[];
};

type EditingTask = {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: 'low' | 'med' | 'high';
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t))
      );

      const statusLabel = newStatus === 'in_progress' ? 'started' : newStatus;
      showToast(`Task ${statusLabel}`, 'success');

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

  function openEditModal(task: Task) {
    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority,
    });
  }

  function closeEditModal() {
    setEditingTask(null);
  }

  async function saveTaskEdits() {
    if (!editingTask) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTask.title,
          description: editingTask.description || null,
          due_date: editingTask.due_date || null,
          priority: editingTask.priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      const { task: updatedTask } = await response.json();

      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...updatedTask } : t))
      );

      showToast('Task updated successfully', 'success');
      closeEditModal();
    } catch (error) {
      console.error('Failed to save task edits:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update task', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function getDateGroup(dateString: string | null): string {
    if (!dateString) return 'no_date';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const taskDate = new Date(dateString + 'T12:00:00');
    taskDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return 'this_week';
    return 'later';
  }

  function groupTasksByDate(tasks: Task[]): DateGroup[] {
    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      this_week: [],
      later: [],
      no_date: [],
    };

    tasks.forEach((task) => {
      const group = getDateGroup(task.due_date);
      groups[group].push(task);
    });

    // Sort tasks within each group by priority
    const priorityOrder = { high: 0, med: 1, low: 2 };
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    });

    const groupLabels: Record<string, string> = {
      overdue: 'Overdue',
      today: 'Today',
      tomorrow: 'Tomorrow',
      this_week: 'This Week',
      later: 'Later',
      no_date: 'No Due Date',
    };

    return Object.entries(groups)
      .filter(([, tasks]) => tasks.length > 0)
      .map(([key, tasks]) => ({
        key,
        label: groupLabels[key],
        tasks,
      }));
  }

  function getPriorityDot(priority: string) {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'med':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-400';
      default:
        return 'bg-gray-400';
    }
  }

  function formatDueDate(dateString: string | null) {
    if (!dateString) return null;
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  function isOverdue(dateString: string | null): boolean {
    if (!dateString) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dateString + 'T12:00:00');
    taskDate.setHours(0, 0, 0, 0);
    return taskDate < today;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  const groupedTasks = groupTasksByDate(tasks);
  const totalTasks = tasks.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show completed
          </label>
        </div>

        {/* Task List */}
        {groupedTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {includeCompleted ? 'No tasks found' : 'All caught up!'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedTasks.map((group) => (
              <div key={group.key}>
                {/* Group Header */}
                <div className="flex items-center gap-2 mb-2">
                  <h2 className={`text-sm font-medium ${
                    group.key === 'overdue' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {group.label}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {group.tasks.length}
                  </span>
                </div>

                {/* Task Rows */}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {group.tasks.map((task) => {
                    const isExpanded = expandedId === task.id;
                    const isProcessing = processingIds.has(task.id);
                    const overdue = isOverdue(task.due_date);

                    return (
                      <div key={task.id}>
                        {/* Compact Row */}
                        <div
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                            task.status === 'completed' ? 'opacity-60' : ''
                          }`}
                          onClick={() => setExpandedId(isExpanded ? null : task.id)}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (task.status === 'completed') {
                                updateTaskStatus(task.id, 'todo');
                              } else {
                                updateTaskStatus(task.id, 'completed');
                              }
                            }}
                            disabled={isProcessing}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              task.status === 'completed'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-gray-400'
                            } ${isProcessing ? 'opacity-50' : ''}`}
                          >
                            {task.status === 'completed' && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {/* Priority Dot */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`} />

                          {/* Title */}
                          <span className={`flex-1 text-sm text-gray-900 truncate ${
                            task.status === 'completed' ? 'line-through text-gray-500' : ''
                          }`}>
                            {task.title}
                          </span>

                          {/* Status Badge (only for in_progress) */}
                          {task.status === 'in_progress' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                              In Progress
                            </span>
                          )}

                          {/* Due Date */}
                          {task.due_date && (
                            <span className={`text-xs flex-shrink-0 ${
                              overdue && task.status !== 'completed'
                                ? 'text-red-600 font-medium'
                                : 'text-gray-400'
                            }`}>
                              {formatDueDate(task.due_date)}
                            </span>
                          )}

                          {/* Expand Chevron */}
                          <svg
                            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
                            {/* Description */}
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-3 ml-8">
                                {task.description}
                              </p>
                            )}

                            {/* Meta Info */}
                            <div className="text-xs text-gray-500 mb-3 ml-8 space-y-1">
                              <div>
                                <span className="font-medium">From email:</span>{' '}
                                {task.email.subject}
                              </div>
                              <div>
                                <span className="font-medium">Priority:</span>{' '}
                                <span className={
                                  task.priority === 'high' ? 'text-red-600' :
                                  task.priority === 'med' ? 'text-yellow-600' : 'text-blue-600'
                                }>
                                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 ml-8">
                              <button
                                onClick={() => openEditModal(task)}
                                className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                Edit
                              </button>
                              {task.status === 'todo' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                  disabled={isProcessing}
                                  className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Start
                                </button>
                              )}
                              {task.status === 'in_progress' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'todo')}
                                  disabled={isProcessing}
                                  className="text-xs px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                >
                                  Pause
                                </button>
                              )}
                              {task.status !== 'completed' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'completed')}
                                  disabled={isProcessing}
                                  className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  Complete
                                </button>
                              )}
                              {task.status === 'completed' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'todo')}
                                  disabled={isProcessing}
                                  className="text-xs px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                >
                                  Reopen
                                </button>
                              )}
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
          <a href="/approvals" className="text-sm text-blue-600 hover:text-blue-800">
            Approvals →
          </a>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Task</h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Task title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Task description"
                  rows={3}
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editingTask.due_date}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={editingTask.priority}
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as 'low' | 'med' | 'high' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="med">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTaskEdits}
                disabled={isSaving || !editingTask.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
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

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          loadTasks();
          showToast('Task created', 'success');
        }}
      />
    </div>
  );
}
