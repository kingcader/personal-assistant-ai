'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export interface UnscheduledTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  email_subject: string | null;
}

interface UnscheduledSidebarProps {
  tasks: UnscheduledTask[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface DraggableTaskProps {
  task: UnscheduledTask;
}

function DraggableTask({ task }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = {
    high: 'border-l-red-500 bg-red-50',
    med: 'border-l-yellow-500 bg-yellow-50',
    low: 'border-l-blue-500 bg-blue-50',
  };

  const priorityBadge = {
    high: 'bg-red-100 text-red-700',
    med: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly < today) {
      return 'Overdue';
    }
    if (dateOnly.getTime() === today.getTime()) {
      return 'Today';
    }
    if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        border-l-4 rounded-r-lg p-2.5 cursor-grab active:cursor-grabbing
        ${priorityColors[task.priority]}
        ${isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'}
        transition-shadow
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {task.title}
          </p>
          {task.due_date && (
            <p className={`text-xs mt-0.5 ${
              new Date(task.due_date + 'T12:00:00') < new Date()
                ? 'text-red-600 font-medium'
                : 'text-gray-500'
            }`}>
              {formatDueDate(task.due_date)}
            </p>
          )}
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${priorityBadge[task.priority]}`}>
          {task.priority === 'med' ? 'Med' : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>
    </div>
  );
}

export default function UnscheduledSidebar({
  tasks,
  isLoading,
  onRefresh,
}: UnscheduledSidebarProps) {
  // Group tasks by priority
  const highPriority = tasks.filter((t) => t.priority === 'high');
  const medPriority = tasks.filter((t) => t.priority === 'med');
  const lowPriority = tasks.filter((t) => t.priority === 'low');

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Unscheduled</h2>
          <p className="text-xs text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-gray-100 rounded-full"
            title="Refresh"
          >
            <svg
              className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-2 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>All tasks scheduled!</p>
          </div>
        ) : (
          <>
            {/* High priority section */}
            {highPriority.length > 0 && (
              <div className="space-y-1.5">
                {highPriority.map((task) => (
                  <DraggableTask key={task.id} task={task} />
                ))}
              </div>
            )}

            {/* Medium priority section */}
            {medPriority.length > 0 && (
              <div className="space-y-1.5">
                {highPriority.length > 0 && (
                  <div className="h-px bg-gray-200 my-2" />
                )}
                {medPriority.map((task) => (
                  <DraggableTask key={task.id} task={task} />
                ))}
              </div>
            )}

            {/* Low priority section */}
            {lowPriority.length > 0 && (
              <div className="space-y-1.5">
                {(highPriority.length > 0 || medPriority.length > 0) && (
                  <div className="h-px bg-gray-200 my-2" />
                )}
                {lowPriority.map((task) => (
                  <DraggableTask key={task.id} task={task} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Drag tasks to the calendar to schedule
        </p>
      </div>
    </div>
  );
}
