'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronDown, Check, X } from 'lucide-react';
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
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t)));

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
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? { ...t, ...updatedTask } : t)));
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
      overdue: [], today: [], tomorrow: [], this_week: [], later: [], no_date: [],
    };

    tasks.forEach((task) => {
      const group = getDateGroup(task.due_date);
      groups[group].push(task);
    });

    const priorityOrder = { high: 0, med: 1, low: 2 };
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    });

    const groupLabels: Record<string, string> = {
      overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow',
      this_week: 'This Week', later: 'Later', no_date: 'No Due Date',
    };

    return Object.entries(groups)
      .filter(([, tasks]) => tasks.length > 0)
      .map(([key, tasks]) => ({ key, label: groupLabels[key], tasks }));
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'high': return 'bg-destructive';
      case 'med': return 'bg-warning';
      case 'low': return 'bg-primary';
      default: return 'bg-muted-foreground';
    }
  }

  function formatDueDate(dateString: string | null) {
    if (!dateString) return null;
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-3 w-64">
          <div className="h-4 bg-muted rounded-full w-3/4"></div>
          <div className="h-4 bg-muted rounded-full w-1/2"></div>
          <div className="h-4 bg-muted rounded-full w-2/3"></div>
        </div>
      </div>
    );
  }

  const groupedTasks = groupTasksByDate(tasks);
  const totalTasks = tasks.length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-ios-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary/20"
            />
            Show completed
          </label>
        </div>

        {/* Task List */}
        {groupedTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {includeCompleted ? 'No tasks found' : 'All caught up!'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedTasks.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className={`text-sm font-medium ${
                    group.key === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {group.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </div>

                <div className="card-ios p-0 divide-y divide-border">
                  {group.tasks.map((task) => {
                    const isExpanded = expandedId === task.id;
                    const isProcessing = processingIds.has(task.id);
                    const overdue = isOverdue(task.due_date);

                    return (
                      <div key={task.id}>
                        <div
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted ${
                            task.status === 'completed' ? 'opacity-60' : ''
                          }`}
                          onClick={() => setExpandedId(isExpanded ? null : task.id)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTaskStatus(task.id, task.status === 'completed' ? 'todo' : 'completed');
                            }}
                            disabled={isProcessing}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              task.status === 'completed'
                                ? 'bg-success border-success text-success-foreground'
                                : 'border-border hover:border-primary'
                            } ${isProcessing ? 'opacity-50' : ''}`}
                          >
                            {task.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                          </button>

                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />

                          <span className={`flex-1 text-sm truncate ${
                            task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                          }`}>
                            {task.title}
                          </span>

                          {task.status === 'in_progress' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                              In Progress
                            </span>
                          )}

                          {task.due_date && (
                            <span className={`text-xs flex-shrink-0 ${
                              overdue && task.status !== 'completed' ? 'text-destructive font-medium' : 'text-muted-foreground'
                            }`}>
                              {formatDueDate(task.due_date)}
                            </span>
                          )}

                          <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`} />
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 bg-muted/30 border-t">
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-3 ml-9">{task.description}</p>
                            )}

                            <div className="text-xs text-muted-foreground mb-3 ml-9 space-y-1">
                              <div><span className="font-medium">From email:</span> {task.email.subject}</div>
                              <div>
                                <span className="font-medium">Priority:</span>{' '}
                                <span className={
                                  task.priority === 'high' ? 'text-destructive' :
                                  task.priority === 'med' ? 'text-warning' : 'text-primary'
                                }>
                                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 ml-9">
                              <button
                                onClick={() => openEditModal(task)}
                                className="btn-ios-secondary text-xs py-1.5"
                              >
                                Edit
                              </button>
                              {task.status === 'todo' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                  disabled={isProcessing}
                                  className="btn-ios-primary text-xs py-1.5"
                                >
                                  Start
                                </button>
                              )}
                              {task.status === 'in_progress' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'todo')}
                                  disabled={isProcessing}
                                  className="btn-ios-secondary text-xs py-1.5"
                                >
                                  Pause
                                </button>
                              )}
                              {task.status !== 'completed' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'completed')}
                                  disabled={isProcessing}
                                  className="text-xs px-4 py-1.5 rounded-xl font-medium bg-success text-success-foreground active:scale-[0.97]"
                                >
                                  Complete
                                </button>
                              )}
                              {task.status === 'completed' && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, 'todo')}
                                  disabled={isProcessing}
                                  className="btn-ios-secondary text-xs py-1.5"
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
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-ios max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Task</h2>
              <button onClick={closeEditModal} className="p-2 -mr-2 rounded-xl hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="input-ios"
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="input-ios min-h-[80px] resize-none"
                  placeholder="Task description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={editingTask.due_date}
                  onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                  className="input-ios"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={editingTask.priority}
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as 'low' | 'med' | 'high' })}
                  className="input-ios"
                >
                  <option value="low">Low</option>
                  <option value="med">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                disabled={isSaving}
                className="flex-1 btn-ios-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveTaskEdits}
                disabled={isSaving || !editingTask.title.trim()}
                className="flex-1 btn-ios-primary"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
          <div className={`rounded-xl px-4 py-3 shadow-lg text-sm ${
            toast.type === 'success' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

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
