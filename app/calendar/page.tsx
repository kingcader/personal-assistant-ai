'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import AgendaList from '@/components/calendar/AgendaList';
import WeekGrid, { WeekGridEvent } from '@/components/calendar/WeekGrid';
import PrepPacket, { PrepPacketData } from '@/components/calendar/PrepPacket';
import UnscheduledSidebar, { UnscheduledTask } from '@/components/calendar/UnscheduledSidebar';
import CreateEventModal from '@/components/calendar/CreateEventModal';
import CreateTaskModal from '@/components/calendar/CreateTaskModal';
import { CalendarItemProps } from '@/components/calendar/CalendarItem';

interface CalendarTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  email_subject: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  is_scheduled?: boolean;
  is_all_day?: boolean;
}

interface CalendarEvent {
  id: string;
  google_event_id: string;
  summary: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  attendees: { email: string; name: string | null }[];
  location: string | null;
  meeting_link: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  prep_packet_id: string | null;
  has_prep_packet: boolean;
}

interface SchedulingSuggestion {
  id: string;
  task_id: string;
  task_title: string;
  task_priority: string;
  suggested_start: string;
  suggested_end: string;
  reason: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

type ViewFilter = 'all' | 'events' | 'tasks' | 'suggestions';
type ViewMode = 'list' | 'week';

export default function CalendarPage() {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<UnscheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('calendarViewMode') as ViewMode) || 'list';
    }
    return 'list';
  });
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Week navigation for grid view
  const [weekOffset, setWeekOffset] = useState(0);

  // Prep packet modal
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [prepPacket, setPrepPacket] = useState<PrepPacketData | null>(null);
  const [loadingPrep, setLoadingPrep] = useState(false);
  const [regeneratingPrep, setRegeneratingPrep] = useState(false);

  // Task detail modal
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  // Sidebar visibility
  const [showSidebar, setShowSidebar] = useState(true);

  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Drag state
  const [activeDragItem, setActiveDragItem] = useState<any>(null);

  // Date range - 14 days from today
  const [startDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [endDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const response = await fetch(`/api/calendar?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load calendar data');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
      setEvents(data.events || []);
      setSuggestions(data.scheduling_suggestions || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      showToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, showToast]);

  const loadUnscheduledTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/tasks?scheduled=false&limit=100');
      if (!response.ok) {
        throw new Error('Failed to load unscheduled tasks');
      }
      const data = await response.json();
      setUnscheduledTasks(
        (data.tasks || []).filter(
          (t: any) => t.status !== 'completed' && t.status !== 'cancelled'
        )
      );
    } catch (err) {
      console.error('Failed to load unscheduled tasks:', err);
    }
  }, []);

  useEffect(() => {
    loadCalendarData();
    loadUnscheduledTasks();
  }, [loadCalendarData, loadUnscheduledTasks]);

  // Load prep packet
  const loadPrepPacket = useCallback(async (eventId: string, regenerate: boolean = false) => {
    try {
      if (regenerate) {
        setRegeneratingPrep(true);
      } else {
        setLoadingPrep(true);
      }

      const method = regenerate ? 'POST' : 'GET';
      const response = await fetch(`/api/calendar/${eventId}/prep`, { method });

      if (!response.ok) {
        throw new Error('Failed to load prep packet');
      }

      const data = await response.json();
      setPrepPacket(data.prep_packet);

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, has_prep_packet: true, prep_packet_id: data.prep_packet.id } : e
        )
      );
    } catch (err) {
      showToast('Failed to load prep packet', 'error');
    } finally {
      setLoadingPrep(false);
      setRegeneratingPrep(false);
    }
  }, [showToast]);

  const handleViewPrep = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    loadPrepPacket(eventId);
  }, [loadPrepPacket]);

  const handleRegeneratePrep = useCallback(() => {
    if (selectedEventId) {
      loadPrepPacket(selectedEventId, true);
    }
  }, [selectedEventId, loadPrepPacket]);

  const handleClosePrep = useCallback(() => {
    setSelectedEventId(null);
    setPrepPacket(null);
  }, []);

  // Task actions
  const handleTaskComplete = useCallback(async (taskId: string) => {
    setProcessingIds((prev) => new Set(prev).add(taskId));
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!response.ok) throw new Error('Failed to complete task');

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t))
      );
      setUnscheduledTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast('Task completed', 'success');
    } catch {
      showToast('Failed to complete task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [showToast]);

  const handleTaskStart = useCallback(async (taskId: string) => {
    setProcessingIds((prev) => new Set(prev).add(taskId));
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      if (!response.ok) throw new Error('Failed to start task');

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'in_progress' } : t))
      );
      showToast('Task started', 'success');
    } catch {
      showToast('Failed to start task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [showToast]);

  const handleUnscheduleTask = useCallback(async (taskId: string) => {
    setProcessingIds((prev) => new Set(prev).add(taskId));
    try {
      const response = await fetch(`/api/tasks/${taskId}/schedule`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to unschedule task');

      // Update task in local state
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, is_scheduled: false, scheduled_start: null, scheduled_end: null }
            : t
        )
      );

      // Reload unscheduled tasks to include this one
      loadUnscheduledTasks();
      showToast('Task unscheduled', 'success');
    } catch {
      showToast('Failed to unschedule task', 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [showToast, loadUnscheduledTasks]);

  // Suggestion actions
  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    setProcessingIds((prev) => new Set(prev).add(suggestionId));
    try {
      const response = await fetch(`/api/tasks/schedule/${suggestionId}/accept`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to accept suggestion');

      setSuggestions((prev) =>
        prev.filter((s) => s.id !== suggestionId)
      );
      loadCalendarData();
      showToast('Suggestion accepted', 'success');
    } catch {
      showToast('Failed to accept suggestion', 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  }, [showToast, loadCalendarData]);

  const handleDismissSuggestion = useCallback(async (suggestionId: string) => {
    setProcessingIds((prev) => new Set(prev).add(suggestionId));
    try {
      const response = await fetch(`/api/tasks/schedule/${suggestionId}/dismiss`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to dismiss suggestion');

      setSuggestions((prev) =>
        prev.filter((s) => s.id !== suggestionId)
      );
      showToast('Suggestion dismissed', 'success');
    } catch {
      showToast('Failed to dismiss suggestion', 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  }, [showToast]);

  // Schedule task via drag-drop
  const handleScheduleTask = useCallback(async (
    taskId: string,
    dayKey: string,
    hour: number
  ) => {
    try {
      const startDateTime = new Date(dayKey + 'T00:00:00');
      startDateTime.setHours(hour, 0, 0, 0);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour default

      console.log('[handleScheduleTask] Scheduling task:', {
        taskId,
        dayKey,
        hour,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
      });

      const response = await fetch(`/api/tasks/${taskId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_start: startDateTime.toISOString(),
          scheduled_end: endDateTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[handleScheduleTask] API error:', {
          status: response.status,
          error: data.error,
          taskId,
        });
        throw new Error(data.error || 'Failed to schedule task');
      }

      console.log('[handleScheduleTask] Success:', data);

      // Remove from unscheduled tasks
      setUnscheduledTasks((prev) => prev.filter((t) => t.id !== taskId));

      // Reload calendar data to show the scheduled task
      loadCalendarData();
      showToast('Task scheduled', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule task';
      console.error('[handleScheduleTask] Error:', err);
      showToast(errorMessage, 'error');
    }
  }, [showToast, loadCalendarData]);

  // Schedule task as all-day
  const handleScheduleAllDayTask = useCallback(async (
    taskId: string,
    dayKey: string
  ) => {
    if (!taskId) {
      console.error('[handleScheduleAllDayTask] No taskId provided');
      showToast('Unable to schedule: missing task ID', 'error');
      return;
    }

    try {
      console.log('[handleScheduleAllDayTask] Scheduling all-day task:', {
        taskId,
        dayKey,
      });

      const response = await fetch(`/api/tasks/${taskId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_all_day: true,
          date: dayKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[handleScheduleAllDayTask] API error:', {
          status: response.status,
          error: data.error,
          taskId,
          dayKey,
        });
        throw new Error(data.error || 'Failed to schedule task');
      }

      console.log('[handleScheduleAllDayTask] Success:', data);

      // Remove from unscheduled tasks (if it was there)
      setUnscheduledTasks((prev) => prev.filter((t) => t.id !== taskId));

      // Update local tasks state immediately for faster UI
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, is_scheduled: true, is_all_day: true, scheduled_start: dayKey + 'T00:00:00', scheduled_end: null }
            : t
        )
      );

      showToast('Task moved', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule task';
      console.error('[handleScheduleAllDayTask] Error:', err);
      showToast(errorMessage, 'error');
      // Reload to restore correct state on error
      loadCalendarData();
    }
  }, [showToast, loadCalendarData]);

  // Update due date for unscheduled tasks
  const handleUpdateDueDate = useCallback(async (
    taskId: string,
    newDueDate: string // YYYY-MM-DD format
  ) => {
    if (!taskId) {
      console.error('[handleUpdateDueDate] No taskId provided');
      return;
    }

    try {
      console.log('[handleUpdateDueDate] Updating due date:', { taskId, newDueDate });

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: newDueDate }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[handleUpdateDueDate] API error:', {
          status: response.status,
          error: data.error,
          taskId,
        });
        throw new Error(data.error || 'Failed to update due date');
      }

      console.log('[handleUpdateDueDate] Success:', data);

      // Update local tasks state immediately for faster UI
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, due_date: newDueDate } : t
        )
      );

      showToast('Due date updated', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update due date';
      console.error('[handleUpdateDueDate] Error:', err);
      showToast(errorMessage, 'error');
      loadCalendarData();
    }
  }, [showToast, loadCalendarData]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragItem(null);

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    console.log('[handleDragEnd] Drag ended:', {
      activeId: active.id,
      activeType: activeData?.type,
      activeTaskId: activeData?.task?.id,
      activeEventId: activeData?.event?.id,
      overId: over.id,
      overType: overData?.type,
    });

    // Get task ID from either sidebar (task) or WeekGrid (event) data structure
    const getTaskId = () => {
      const taskId = activeData?.task?.id || activeData?.event?.id;
      console.log('[handleDragEnd] Extracted taskId:', taskId);
      return taskId;
    };

    // Dropping a task on a time slot
    if (activeData?.type === 'task' && overData?.type === 'time-slot') {
      const taskId = getTaskId();
      if (!taskId) {
        console.error('[handleDragEnd] No task ID found for time-slot drop');
        return;
      }
      const { dayKey, hour } = overData;
      handleScheduleTask(taskId, dayKey, hour);
    }

    // Dropping a task on an all-day slot
    if (activeData?.type === 'task' && overData?.type === 'all-day-slot') {
      const taskId = getTaskId();
      if (!taskId) {
        console.error('[handleDragEnd] No task ID found for all-day-slot drop');
        return;
      }
      const { dayKey } = overData;

      // Check if this is a due-date-only task (not scheduled)
      // If so, update the due_date; otherwise schedule as all-day
      const eventData = activeData?.event;
      const isDueDateTask = eventData?.hasDueDate && !eventData?.isScheduled;

      console.log('[handleDragEnd] All-day drop:', {
        taskId,
        dayKey,
        isDueDateTask,
        hasDueDate: eventData?.hasDueDate,
        isScheduled: eventData?.isScheduled,
      });

      if (isDueDateTask) {
        // Update due date instead of scheduling
        handleUpdateDueDate(taskId, dayKey);
      } else {
        // Schedule as all-day task
        handleScheduleAllDayTask(taskId, dayKey);
      }
    }
  }, [handleScheduleTask, handleScheduleAllDayTask, handleUpdateDueDate]);

  // Build calendar days
  const buildCalendarDays = useCallback(() => {
    const days: { date: Date; label: string; items: CalendarItemProps[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayMap = new Map<string, CalendarItemProps[]>();

    // Add events
    if (viewFilter === 'all' || viewFilter === 'events') {
      events
        .filter((e) => e.status === 'confirmed')
        .forEach((event) => {
          const eventDate = new Date(event.start_time);
          eventDate.setHours(0, 0, 0, 0);
          const key = eventDate.toISOString().split('T')[0];

          if (!dayMap.has(key)) dayMap.set(key, []);
          dayMap.get(key)!.push({
            type: 'event',
            id: event.id,
            title: event.summary || '(No title)',
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            allDay: event.all_day,
            location: event.location,
            meetingLink: event.meeting_link,
            attendees: event.attendees,
            hasPrepPacket: event.has_prep_packet,
          });
        });
    }

    // Add tasks (both scheduled and unscheduled with due dates)
    if (viewFilter === 'all' || viewFilter === 'tasks') {
      tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        .forEach((task) => {
          // Use scheduled time if available, otherwise due date
          let taskDate: Date;
          let taskStartTime: Date;
          let taskEndTime: Date | undefined;
          let isAllDay = true;

          if (task.is_scheduled && task.scheduled_start) {
            taskStartTime = new Date(task.scheduled_start);
            taskEndTime = task.scheduled_end ? new Date(task.scheduled_end) : undefined;
            taskDate = new Date(taskStartTime);
            taskDate.setHours(0, 0, 0, 0);
            isAllDay = false;
          } else if (task.due_date) {
            taskDate = new Date(task.due_date + 'T12:00:00');
            taskDate.setHours(0, 0, 0, 0);
            taskStartTime = taskDate;
          } else {
            return; // Skip tasks without dates in calendar view
          }

          const key = taskDate.toISOString().split('T')[0];
          if (!dayMap.has(key)) dayMap.set(key, []);
          dayMap.get(key)!.push({
            type: 'task',
            id: task.id,
            title: task.title,
            startTime: taskStartTime,
            endTime: taskEndTime,
            allDay: isAllDay,
            priority: task.priority,
            status: task.status,
            description: task.description,
            emailSubject: task.email_subject,
            isScheduled: task.is_scheduled,
          });
        });
    }

    // Add scheduling suggestions
    if (viewFilter === 'all' || viewFilter === 'suggestions') {
      suggestions
        .filter((s) => s.status === 'pending')
        .forEach((suggestion) => {
          const sugDate = new Date(suggestion.suggested_start);
          sugDate.setHours(0, 0, 0, 0);
          const key = sugDate.toISOString().split('T')[0];

          if (!dayMap.has(key)) dayMap.set(key, []);
          dayMap.get(key)!.push({
            type: 'suggestion',
            id: suggestion.id,
            title: suggestion.reason,
            taskTitle: suggestion.task_title,
            startTime: new Date(suggestion.suggested_start),
            endTime: new Date(suggestion.suggested_end),
            reason: suggestion.reason,
          });
        });
    }

    // Sort days and build labels
    const sortedKeys = Array.from(dayMap.keys()).sort();
    sortedKeys.forEach((key) => {
      const date = new Date(key + 'T12:00:00');
      const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let label: string;
      if (diffDays < 0) {
        label = `Overdue (${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`;
      } else if (diffDays === 0) {
        label = 'Today';
      } else if (diffDays === 1) {
        label = 'Tomorrow';
      } else if (diffDays < 7) {
        label = date.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }

      const items = dayMap.get(key)!.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.startTime.getTime() - b.startTime.getTime();
      });

      days.push({ date, label, items });
    });

    return days;
  }, [events, tasks, suggestions, viewFilter]);

  // Build week grid events
  const buildWeekGridEvents = useCallback((): WeekGridEvent[] => {
    const weekEvents: WeekGridEvent[] = [];

    if (viewFilter === 'all' || viewFilter === 'events') {
      events
        .filter((e) => e.status === 'confirmed')
        .forEach((event) => {
          weekEvents.push({
            id: event.id,
            type: 'event',
            title: event.summary || '(No title)',
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            allDay: event.all_day,
            hasPrepPacket: event.has_prep_packet,
            meetingLink: event.meeting_link || undefined,
          });
        });
    }

    if (viewFilter === 'all' || viewFilter === 'tasks') {
      tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        .forEach((task) => {
          if (task.is_scheduled && task.is_all_day && task.scheduled_start) {
            // All-day scheduled task
            const taskDate = new Date(task.scheduled_start);
            weekEvents.push({
              id: task.id,
              type: 'task',
              title: task.title,
              startTime: taskDate,
              allDay: true,
              priority: task.priority,
              status: task.status,
              isScheduled: true,
            });
          } else if (task.is_scheduled && task.scheduled_start) {
            // Timed scheduled task
            weekEvents.push({
              id: task.id,
              type: 'task',
              title: task.title,
              startTime: new Date(task.scheduled_start),
              endTime: task.scheduled_end ? new Date(task.scheduled_end) : undefined,
              allDay: false,
              priority: task.priority,
              status: task.status,
              isScheduled: true,
            });
          } else if (task.due_date) {
            // Unscheduled task with due date - can be dragged to change due date
            const taskDate = new Date(task.due_date + 'T09:00:00');
            weekEvents.push({
              id: task.id,
              type: 'task',
              title: task.title,
              startTime: taskDate,
              allDay: true,
              priority: task.priority,
              status: task.status,
              isScheduled: false,
              hasDueDate: true,
            });
          }
        });
    }

    if (viewFilter === 'all' || viewFilter === 'suggestions') {
      suggestions
        .filter((s) => s.status === 'pending')
        .forEach((suggestion) => {
          weekEvents.push({
            id: suggestion.id,
            type: 'suggestion',
            title: suggestion.task_title,
            startTime: new Date(suggestion.suggested_start),
            endTime: new Date(suggestion.suggested_end),
            reason: suggestion.reason,
          });
        });
    }

    return weekEvents;
  }, [events, tasks, suggestions, viewFilter]);

  // Week start date for grid view
  const weekStartDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    return sunday;
  }, [weekOffset]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendarViewMode', mode);
    }
  }, []);

  const handleWeekGridEventClick = useCallback((event: WeekGridEvent) => {
    if (event.type === 'event') {
      handleViewPrep(event.id);
    } else if (event.type === 'task') {
      // Find the task from our tasks array
      const task = tasks.find(t => t.id === event.id);
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [handleViewPrep, tasks]);

  const handleCreated = useCallback(() => {
    loadCalendarData();
    loadUnscheduledTasks();
  }, [loadCalendarData, loadUnscheduledTasks]);

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

  const calendarDays = buildCalendarDays();
  const totalEvents = events.filter((e) => e.status === 'confirmed').length;
  const totalTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
  const totalSuggestions = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-background flex pb-20 md:pb-0">
        {/* Sidebar - hidden on mobile */}
        {showSidebar && viewMode === 'week' && (
          <div className="hidden sm:block">
            <UnscheduledSidebar
              tasks={unscheduledTasks}
              onRefresh={loadUnscheduledTasks}
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            {/* Header */}
            <div className="mb-4 sm:mb-6 flex items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold">Calendar</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                  {totalEvents} events · {totalTasks} tasks · {totalSuggestions} suggestions
                </p>
              </div>

              {/* FAB buttons */}
              <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowCreateTaskModal(true)}
                  className="btn-ios-primary flex items-center justify-center gap-1 sm:gap-1.5 p-2 sm:px-3 sm:py-2 text-sm"
                  title="Add Task"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Task</span>
                </button>
                <button
                  onClick={() => setShowCreateEventModal(true)}
                  className="btn-ios-secondary flex items-center justify-center gap-1 sm:gap-1.5 p-2 sm:px-3 sm:py-2 text-sm"
                  title="Add Event"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Event</span>
                </button>
              </div>
            </div>

            {/* View Toggle & Filters */}
            <div className="mb-4 space-y-3">
              {/* Top row: View mode + Week nav */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-0.5 bg-secondary rounded-xl p-0.5">
                  <button
                    onClick={() => handleViewModeChange('list')}
                    className={`px-2.5 py-1.5 text-sm rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-card shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <span className="hidden xs:inline">List</span>
                    </span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('week')}
                    className={`px-2.5 py-1.5 text-sm rounded-lg transition-all ${
                      viewMode === 'week'
                        ? 'bg-card shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden xs:inline">Week</span>
                    </span>
                  </button>
                </div>

                {/* Week Navigation (only in week mode) */}
                {viewMode === 'week' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setWeekOffset((prev) => prev - 1)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setWeekOffset(0)}
                      className="px-2 py-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground font-medium"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setWeekOffset((prev) => prev + 1)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <span className="text-xs sm:text-sm text-muted-foreground ml-1 hidden sm:inline">
                      {weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                      {new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {/* Sidebar toggle (only in week mode) - hidden on mobile */}
                {viewMode === 'week' && (
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className={`hidden sm:block p-1.5 rounded-lg hover:bg-muted transition-colors ml-auto ${
                      showSidebar ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Content Filters - scrollable on mobile */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
                {(['all', 'events', 'tasks', 'suggestions'] as ViewFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setViewFilter(filter)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl whitespace-nowrap transition-all flex-shrink-0 active:scale-[0.97] ${
                      viewFilter === filter
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    <span className="hidden sm:inline">
                      {filter === 'events' && ` (${totalEvents})`}
                      {filter === 'tasks' && ` (${totalTasks})`}
                      {filter === 'suggestions' && ` (${totalSuggestions})`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error state */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                {error}
                <button
                  onClick={loadCalendarData}
                  className="ml-2 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Calendar View */}
            {viewMode === 'list' ? (
              <AgendaList
                days={calendarDays}
                onTaskComplete={handleTaskComplete}
                onTaskStart={handleTaskStart}
                onViewPrep={handleViewPrep}
                onAcceptSuggestion={handleAcceptSuggestion}
                onDismissSuggestion={handleDismissSuggestion}
                processingIds={processingIds}
              />
            ) : (
              <div className="-mx-3 sm:mx-0">
                <WeekGrid
                  events={buildWeekGridEvents()}
                  startDate={weekStartDate}
                  onEventClick={handleWeekGridEventClick}
                  enableDragDrop={true}
                />
              </div>
            )}

          </div>
        </div>

        {/* Prep Packet Modal */}
        {selectedEventId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="max-w-lg w-full max-h-[80vh] overflow-auto">
              {loadingPrep ? (
                <div className="card-ios p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-muted-foreground">Generating prep packet...</p>
                </div>
              ) : prepPacket ? (
                <PrepPacket
                  packet={prepPacket}
                  onRegenerate={handleRegeneratePrep}
                  isRegenerating={regeneratingPrep}
                  onClose={handleClosePrep}
                />
              ) : (
                <div className="card-ios p-8 text-center">
                  <p className="text-muted-foreground">Failed to load prep packet</p>
                  <button
                    onClick={handleClosePrep}
                    className="mt-4 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card-ios max-w-md w-full p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
                  {selectedTask.email_subject && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      From: {selectedTask.email_subject}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 -mr-2 -mt-2 rounded-xl hover:bg-muted"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedTask.description && (
                <p className="text-sm text-muted-foreground mb-4">{selectedTask.description}</p>
              )}

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Priority:</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                    selectedTask.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                    selectedTask.priority === 'med' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-primary/10 text-primary'
                  }`}>
                    {selectedTask.priority === 'high' ? 'High' : selectedTask.priority === 'med' ? 'Medium' : 'Low'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20">Status:</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                    selectedTask.status === 'completed' ? 'bg-success/10 text-success' :
                    selectedTask.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {selectedTask.status === 'in_progress' ? 'In Progress' :
                     selectedTask.status.charAt(0).toUpperCase() + selectedTask.status.slice(1)}
                  </span>
                </div>
                {selectedTask.due_date && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20">Due:</span>
                    <span>{new Date(selectedTask.due_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    })}</span>
                  </div>
                )}
                {selectedTask.is_scheduled && selectedTask.scheduled_start && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20">Scheduled:</span>
                    <span>
                      {selectedTask.is_all_day
                        ? new Date(selectedTask.scheduled_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : new Date(selectedTask.scheduled_start).toLocaleString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                          })
                      }
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                {selectedTask.status !== 'completed' && (
                  <>
                    <button
                      onClick={() => {
                        handleTaskComplete(selectedTask.id);
                        setSelectedTask(null);
                      }}
                      disabled={processingIds.has(selectedTask.id)}
                      className="flex-1 text-sm px-4 py-2 rounded-xl font-medium bg-success text-success-foreground active:scale-[0.97]"
                    >
                      Complete
                    </button>
                    {selectedTask.status === 'todo' && (
                      <button
                        onClick={() => {
                          handleTaskStart(selectedTask.id);
                          setSelectedTask(null);
                        }}
                        disabled={processingIds.has(selectedTask.id)}
                        className="flex-1 btn-ios-primary text-sm"
                      >
                        Start
                      </button>
                    )}
                  </>
                )}
                {selectedTask.is_scheduled && (
                  <button
                    onClick={() => {
                      handleUnscheduleTask(selectedTask.id);
                      setSelectedTask(null);
                    }}
                    disabled={processingIds.has(selectedTask.id)}
                    className="flex-1 btn-ios-secondary text-sm"
                  >
                    Unschedule
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Event Modal */}
        <CreateEventModal
          isOpen={showCreateEventModal}
          onClose={() => setShowCreateEventModal(false)}
          onCreated={handleCreated}
        />

        {/* Create Task Modal */}
        <CreateTaskModal
          isOpen={showCreateTaskModal}
          onClose={() => setShowCreateTaskModal(false)}
          onCreated={handleCreated}
        />

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
            <div
              className={`rounded-xl px-4 py-3 shadow-lg text-sm ${
                toast.type === 'success' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragItem?.type === 'task' && (
            <div className="card-ios border-2 border-primary p-2 shadow-lg opacity-90">
              <p className="text-sm font-medium">
                {activeDragItem.task?.title || activeDragItem.event?.title || 'Task'}
              </p>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
