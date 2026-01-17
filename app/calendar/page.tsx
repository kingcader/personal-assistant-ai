'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import AgendaList from '@/components/calendar/AgendaList';
import WeekGrid, { WeekGridEvent } from '@/components/calendar/WeekGrid';
import PrepPacket, { PrepPacketData } from '@/components/calendar/PrepPacket';
import { CalendarItemProps } from '@/components/calendar/CalendarItem';

interface CalendarTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'med' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  email_subject: string | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Load from localStorage on initial render
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

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

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

      // Update event's has_prep_packet status
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
  }, [showToast]);

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

  // Build calendar days
  const buildCalendarDays = useCallback(() => {
    const days: { date: Date; label: string; items: CalendarItemProps[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group items by day
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

    // Add tasks
    if (viewFilter === 'all' || viewFilter === 'tasks') {
      tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        .forEach((task) => {
          const taskDate = task.due_date ? new Date(task.due_date + 'T12:00:00') : new Date();
          taskDate.setHours(0, 0, 0, 0);
          const key = taskDate.toISOString().split('T')[0];

          if (!dayMap.has(key)) dayMap.set(key, []);
          dayMap.get(key)!.push({
            type: 'task',
            id: task.id,
            title: task.title,
            startTime: taskDate,
            allDay: true,
            priority: task.priority,
            status: task.status,
            description: task.description,
            emailSubject: task.email_subject,
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

      // Sort items within day by time
      const items = dayMap.get(key)!.sort((a, b) => {
        // All-day items first
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        // Then by start time
        return a.startTime.getTime() - b.startTime.getTime();
      });

      days.push({ date, label, items });
    });

    return days;
  }, [events, tasks, suggestions, viewFilter]);

  // Build week grid events
  const buildWeekGridEvents = useCallback((): WeekGridEvent[] => {
    const weekEvents: WeekGridEvent[] = [];

    // Add events
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

    // Add tasks
    if (viewFilter === 'all' || viewFilter === 'tasks') {
      tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        .forEach((task) => {
          const taskDate = task.due_date ? new Date(task.due_date + 'T09:00:00') : new Date();
          weekEvents.push({
            id: task.id,
            type: 'task',
            title: task.title,
            startTime: taskDate,
            allDay: true,
            priority: task.priority,
            status: task.status,
          });
        });
    }

    // Add scheduling suggestions
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
    // Get Sunday of current week
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    return sunday;
  }, [weekOffset]);

  // Handle view mode change with localStorage persistence
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendarViewMode', mode);
    }
  }, []);

  // Handle week grid event click
  const handleWeekGridEventClick = useCallback((event: WeekGridEvent) => {
    if (event.type === 'event') {
      handleViewPrep(event.id);
    }
    // For tasks and suggestions, we could open a modal or navigate
    // For now, just log it
    console.log('Clicked event:', event);
  }, [handleViewPrep]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  const calendarDays = buildCalendarDays();
  const totalEvents = events.filter((e) => e.status === 'confirmed').length;
  const totalTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
  const totalSuggestions = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalEvents} events · {totalTasks} tasks · {totalSuggestions} suggestions
          </p>
        </div>

        {/* View Toggle & Filters */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </span>
            </button>
            <button
              onClick={() => handleViewModeChange('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Week
              </span>
            </button>
          </div>

          {/* Week Navigation (only in week mode) */}
          {viewMode === 'week' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                aria-label="Previous week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Today
              </button>
              <button
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                aria-label="Next week"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className="text-sm text-gray-500 ml-2">
                {weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                {new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Content Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(['all', 'events', 'tasks', 'suggestions'] as ViewFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setViewFilter(filter)}
                className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  viewFilter === filter
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                {filter === 'events' && ` (${totalEvents})`}
                {filter === 'tasks' && ` (${totalTasks})`}
                {filter === 'suggestions' && ` (${totalSuggestions})`}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button
              onClick={loadCalendarData}
              className="ml-2 text-red-800 underline hover:no-underline"
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
          <div className="max-w-full overflow-x-auto">
            <WeekGrid
              events={buildWeekGridEvents()}
              startDate={weekStartDate}
              onEventClick={handleWeekGridEventClick}
            />
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

      {/* Prep Packet Modal */}
      {selectedEventId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-lg w-full max-h-[80vh] overflow-auto">
            {loadingPrep ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-600">Generating prep packet...</p>
              </div>
            ) : prepPacket ? (
              <PrepPacket
                packet={prepPacket}
                onRegenerate={handleRegeneratePrep}
                isRegenerating={regeneratingPrep}
                onClose={handleClosePrep}
              />
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-gray-600">Failed to load prep packet</p>
                <button
                  onClick={handleClosePrep}
                  className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-lg px-4 py-2 shadow-lg text-sm ${
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
