'use client';

import { useState, useMemo } from 'react';

export interface WeekGridEvent {
  id: string;
  type: 'event' | 'task' | 'suggestion';
  title: string;
  startTime: Date;
  endTime?: Date;
  allDay?: boolean;
  priority?: 'low' | 'med' | 'high';
  status?: string;
  hasPrepPacket?: boolean;
  meetingLink?: string;
  reason?: string;
}

interface WeekGridProps {
  events: WeekGridEvent[];
  startDate: Date;
  onEventClick?: (event: WeekGridEvent) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

export default function WeekGrid({
  events,
  startDate,
  onEventClick,
}: WeekGridProps) {
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  // Generate week days
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }, [startDate]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, WeekGridEvent[]>();

    weekDays.forEach((day) => {
      const key = day.toISOString().split('T')[0];
      map.set(key, []);
    });

    events.forEach((event) => {
      const eventDate = new Date(event.startTime);
      const key = eventDate.toISOString().split('T')[0];
      if (map.has(key)) {
        map.get(key)!.push(event);
      }
    });

    return map;
  }, [events, weekDays]);

  // Get all-day items for a day
  const getAllDayItems = (dayKey: string) => {
    return (eventsByDay.get(dayKey) || []).filter((e) => e.allDay);
  };

  // Get timed items for a day
  const getTimedItems = (dayKey: string) => {
    return (eventsByDay.get(dayKey) || []).filter((e) => !e.allDay);
  };

  // Calculate event position and height
  const getEventStyle = (event: WeekGridEvent) => {
    const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60;
    const endTime = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000);
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;

    const top = ((startHour - 7) / 14) * 100; // 7 AM is 0%
    const height = ((endHour - startHour) / 14) * 100;

    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.min(height, 100 - top)}%`,
      minHeight: '24px',
    };
  };

  // Get event color
  const getEventColor = (event: WeekGridEvent) => {
    if (event.type === 'event') {
      return 'bg-purple-100 border-purple-300 text-purple-900';
    }
    if (event.type === 'task') {
      if (event.priority === 'high') return 'bg-red-100 border-red-300 text-red-900';
      if (event.priority === 'med') return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      return 'bg-blue-100 border-blue-300 text-blue-900';
    }
    // Suggestion
    return 'bg-gray-100 border-gray-300 border-dashed text-gray-700 opacity-75';
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatDayHeader = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with day names */}
      <div className="grid grid-cols-8 border-b border-gray-200">
        {/* Time column header */}
        <div className="p-2 text-xs text-gray-500 text-center border-r border-gray-100" />

        {/* Day headers */}
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center border-r border-gray-100 last:border-r-0 ${
              isToday(day) ? 'bg-blue-50' : ''
            }`}
          >
            <div className={`text-sm font-medium ${isToday(day) ? 'text-blue-600' : 'text-gray-700'}`}>
              {formatDayHeader(day)}
            </div>
          </div>
        ))}
      </div>

      {/* All-day section */}
      <div className="grid grid-cols-8 border-b border-gray-200">
        <div className="p-1 text-xs text-gray-500 text-center border-r border-gray-100">
          All day
        </div>
        {weekDays.map((day) => {
          const dayKey = day.toISOString().split('T')[0];
          const allDayItems = getAllDayItems(dayKey);
          return (
            <div
              key={dayKey}
              className={`min-h-[32px] p-0.5 border-r border-gray-100 last:border-r-0 ${
                isToday(day) ? 'bg-blue-50/50' : ''
              }`}
            >
              {allDayItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onEventClick?.(item)}
                  className={`w-full text-xs px-1 py-0.5 rounded truncate text-left mb-0.5 ${getEventColor(item)} border hover:opacity-80`}
                >
                  {item.type === 'task' && '•'} {item.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-8 overflow-y-auto" style={{ height: '500px' }}>
        {/* Time labels */}
        <div className="border-r border-gray-100">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-[50px] border-b border-gray-100 text-xs text-gray-500 text-right pr-2 pt-0.5"
            >
              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day) => {
          const dayKey = day.toISOString().split('T')[0];
          const timedItems = getTimedItems(dayKey);

          return (
            <div
              key={dayKey}
              className={`relative border-r border-gray-100 last:border-r-0 ${
                isToday(day) ? 'bg-blue-50/30' : ''
              }`}
            >
              {/* Hour grid lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-[50px] border-b border-gray-100"
                />
              ))}

              {/* Events */}
              {timedItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onEventClick?.(item)}
                  onMouseEnter={() => setHoveredEvent(item.id)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  className={`absolute left-0.5 right-0.5 px-1 py-0.5 text-xs rounded border overflow-hidden ${getEventColor(item)} hover:z-10 hover:shadow-md transition-shadow`}
                  style={getEventStyle(item)}
                >
                  <div className="font-medium truncate">
                    {item.type === 'suggestion' ? '💡 ' : ''}
                    {item.title}
                  </div>
                  <div className="text-xs opacity-75">
                    {item.startTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                    {item.hasPrepPacket && ' ✨'}
                  </div>
                </button>
              ))}

              {/* Current time indicator */}
              {isToday(day) && (
                <CurrentTimeIndicator />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Only show if within grid hours (7 AM - 9 PM)
  if (currentHour < 7 || currentHour > 21) return null;

  const top = ((currentHour - 7) / 14) * 100;

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top: `${top}%` }}
    >
      <div className="relative">
        <div className="absolute -left-1 w-2 h-2 bg-red-500 rounded-full" />
        <div className="h-0.5 bg-red-500" />
      </div>
    </div>
  );
}
