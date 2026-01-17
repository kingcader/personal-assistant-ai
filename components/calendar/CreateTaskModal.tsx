'use client';

import { useState } from 'react';
import ReminderPicker from './ReminderPicker';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialDate?: Date;
  initialSchedule?: { start: Date; end: Date };
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreated,
  initialDate,
  initialSchedule,
}: CreateTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'med' | 'high'>('med');
  const [dueDate, setDueDate] = useState(() => {
    if (initialDate) {
      return initialDate.toISOString().split('T')[0];
    }
    return '';
  });
  const [scheduleTask, setScheduleTask] = useState(!!initialSchedule);
  const [scheduleDate, setScheduleDate] = useState(() => {
    if (initialSchedule?.start) {
      return initialSchedule.start.toISOString().split('T')[0];
    }
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [scheduleStartTime, setScheduleStartTime] = useState(() => {
    if (initialSchedule?.start) {
      return initialSchedule.start.toTimeString().slice(0, 5);
    }
    return '09:00';
  });
  const [scheduleEndTime, setScheduleEndTime] = useState(() => {
    if (initialSchedule?.end) {
      return initialSchedule.end.toTimeString().slice(0, 5);
    }
    return '10:00';
  });
  const [reminderMinutes, setReminderMinutes] = useState<number | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Create task via API
      // Note: This assumes a task creation endpoint exists. If not, we need to create one.
      // For now, we'll use a direct Supabase insert approach via a new endpoint.
      const taskResponse = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          priority,
          due_date: dueDate || null,
        }),
      });

      if (!taskResponse.ok) {
        const data = await taskResponse.json();
        throw new Error(data.error || 'Failed to create task');
      }

      const { task } = await taskResponse.json();

      // Schedule task if requested
      if (scheduleTask && task.id) {
        const startDateTime = new Date(scheduleDate + 'T' + scheduleStartTime);
        let endDateTime = new Date(scheduleDate + 'T' + scheduleEndTime);

        // If end time is before start time, assume next day
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        const scheduleResponse = await fetch(`/api/tasks/${task.id}/schedule`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduled_start: startDateTime.toISOString(),
            scheduled_end: endDateTime.toISOString(),
          }),
        });

        if (!scheduleResponse.ok) {
          console.warn('Failed to schedule task, but task was created');
        }

        // Create reminder if specified and task is scheduled
        if (reminderMinutes !== undefined) {
          await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity_type: 'task',
              entity_id: task.id,
              minutes_before: reminderMinutes,
            }),
          });
        }
      }

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('med');
      setDueDate('');
      setScheduleTask(false);
      setReminderMinutes(undefined);

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create Task</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'med', 'low'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`
                    flex-1 px-3 py-2 text-sm rounded-lg border transition-colors
                    ${priority === p
                      ? p === 'high'
                        ? 'bg-red-100 border-red-300 text-red-700'
                        : p === 'med'
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                        : 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  {p === 'med' ? 'Medium' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Schedule toggle */}
          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleTask}
                onChange={(e) => setScheduleTask(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Schedule on calendar</span>
            </label>
          </div>

          {/* Schedule inputs */}
          {scheduleTask && (
            <div className="space-y-3 pl-6 border-l-2 border-blue-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End time
                  </label>
                  <input
                    type="time"
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reminder (only available when scheduled) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reminder
                </label>
                <ReminderPicker
                  value={reminderMinutes}
                  onChange={setReminderMinutes}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
