'use client';

import { useState, useMemo, useCallback } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

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
  isScheduled?: boolean;
  hasDueDate?: boolean; // Task has due_date but not scheduled
}

interface WeekGridProps {
  events: WeekGridEvent[];
  startDate: Date;
  onEventClick?: (event: WeekGridEvent) => void;
  enableDragDrop?: boolean;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM
const SLOT_HEIGHT = 50; // pixels per hour

// Droppable time slot component
function TimeSlot({
  dayKey,
  hour,
  isToday,
}: {
  dayKey: string;
  hour: number;
  isToday: boolean;
}) {
  const slotId = `slot-${dayKey}-${hour}`;
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: {
      type: 'time-slot',
      dayKey,
      hour,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        h-[50px] border-b border-gray-100 transition-colors
        ${isOver ? 'bg-blue-100 border-blue-300' : ''}
        ${isToday && !isOver ? 'bg-blue-50/30' : ''}
      `}
    />
  );
}

// Droppable all-day slot component
function AllDayDropZone({
  dayKey,
  isToday,
  children,
}: {
  dayKey: string;
  isToday: boolean;
  children: React.ReactNode;
}) {
  const slotId = `all-day-${dayKey}`;
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: {
      type: 'all-day-slot',
      dayKey,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[32px] p-0.5 border-r border-gray-100 last:border-r-0 transition-colors
        ${isOver ? 'bg-blue-100 ring-2 ring-inset ring-blue-300' : ''}
        ${isToday && !isOver ? 'bg-blue-50/50' : ''}
      `}
    >
      {children}
    </div>
  );
}

// Draggable all-day item component
function DraggableAllDayItem({
  item,
  onClick,
  getEventColor,
  enableDrag,
}: {
  item: WeekGridEvent;
  onClick?: () => void;
  getEventColor: (event: WeekGridEvent) => string;
  enableDrag?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `allday-${item.id}`,
    data: {
      type: 'task',
      event: item,
    },
    disabled: !enableDrag,
  });

  const style: React.CSSProperties = {
    ...(transform ? {
      transform: CSS.Translate.toString(transform),
      zIndex: 50,
      opacity: 0.9,
    } : {}),
    // Ensure touch dragging works properly
    touchAction: enableDrag ? 'none' : 'auto',
  };

  // Handle click only if not dragging
  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      onClick?.();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...(enableDrag ? { ...listeners, ...attributes } : {})}
      onClick={handleClick}
      style={style}
      className={`
        w-full text-xs px-1.5 py-1 rounded truncate text-left mb-0.5 border select-none
        ${getEventColor(item)}
        ${enableDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:opacity-80'}
      `}
    >
      {item.type === 'task' && '•'} {item.title}
    </div>
  );
}

// Draggable event component
function DraggableEvent({
  item,
  style,
  onClick,
  enableDrag,
}: {
  item: WeekGridEvent;
  style: React.CSSProperties;
  onClick?: () => void;
  enableDrag?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event-${item.id}`,
    data: {
      type: item.type,
      event: item,
    },
    disabled: !enableDrag,
  });

  const getEventColor = () => {
    if (item.type === 'event') {
      return 'bg-purple-100 border-purple-300 text-purple-900';
    }
    if (item.type === 'task') {
      if (item.priority === 'high') return 'bg-red-100 border-red-300 text-red-900';
      if (item.priority === 'med') return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      return 'bg-blue-100 border-blue-300 text-blue-900';
    }
    return 'bg-gray-100 border-gray-300 border-dashed text-gray-700 opacity-75';
  };

  const dragStyle = transform
    ? {
        ...style,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
      }
    : style;

  return (
    <button
      ref={setNodeRef}
      {...(enableDrag ? { ...listeners, ...attributes } : {})}
      onClick={onClick}
      className={`
        absolute left-0.5 right-0.5 px-1 py-0.5 text-xs rounded border overflow-hidden
        ${getEventColor()}
        ${enableDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        hover:z-10 hover:shadow-md transition-shadow
        ${isDragging ? 'ring-2 ring-blue-400' : ''}
      `}
      style={dragStyle}
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
  );
}

export default function WeekGrid({
  events,
  startDate,
  onEventClick,
  enableDragDrop = false,
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
  const getAllDayItems = useCallback((dayKey: string) => {
    return (eventsByDay.get(dayKey) || []).filter((e) => e.allDay);
  }, [eventsByDay]);

  // Get timed items for a day
  const getTimedItems = useCallback((dayKey: string) => {
    return (eventsByDay.get(dayKey) || []).filter((e) => !e.allDay);
  }, [eventsByDay]);

  // Calculate event position and height
  const getEventStyle = useCallback((event: WeekGridEvent): React.CSSProperties => {
    const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60;
    const endTime = event.endTime || new Date(event.startTime.getTime() + 60 * 60 * 1000);
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;

    const top = ((startHour - 7) / 14) * 100;
    const height = ((endHour - startHour) / 14) * 100;

    return {
      top: `${Math.max(0, top)}%`,
      height: `${Math.min(height, 100 - top)}%`,
      minHeight: '24px',
    };
  }, []);

  // Get event color
  const getEventColor = useCallback((event: WeekGridEvent) => {
    if (event.type === 'event') {
      return 'bg-purple-100 border-purple-300 text-purple-900';
    }
    if (event.type === 'task') {
      if (event.priority === 'high') return 'bg-red-100 border-red-300 text-red-900';
      if (event.priority === 'med') return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      return 'bg-blue-100 border-blue-300 text-blue-900';
    }
    return 'bg-gray-100 border-gray-300 border-dashed text-gray-700 opacity-75';
  }, []);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }, []);

  const formatDayHeader = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Scrollable container for mobile */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header with day names */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            {/* Time column header */}
            <div className="p-2 text-xs text-gray-500 text-center border-r border-gray-100 w-14 flex-shrink-0" />

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
            <div className="p-1 text-xs text-gray-500 text-center border-r border-gray-100 w-14 flex-shrink-0">
              All day
            </div>
            {weekDays.map((day) => {
              const dayKey = day.toISOString().split('T')[0];
              const allDayItems = getAllDayItems(dayKey);
              const todayFlag = isToday(day);

              // Render all-day items - use draggable for tasks when drag-drop enabled
              const itemsContent = allDayItems.map((item) => {
                // ALL tasks are draggable (not events from Google Calendar)
                // The handler will decide what action to take based on task properties
                const canDrag = enableDragDrop && item.type === 'task';

                if (enableDragDrop && item.type === 'task') {
                  return (
                    <DraggableAllDayItem
                      key={item.id}
                      item={item}
                      onClick={() => onEventClick?.(item)}
                      getEventColor={getEventColor}
                      enableDrag={canDrag}
                    />
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => onEventClick?.(item)}
                    className={`w-full text-xs px-1 py-0.5 rounded truncate text-left mb-0.5 ${getEventColor(item)} border hover:opacity-80`}
                  >
                    {item.type === 'task' && '•'} {item.title}
                  </button>
                );
              });

              // Use droppable zone when drag-drop is enabled
              if (enableDragDrop) {
                return (
                  <AllDayDropZone key={dayKey} dayKey={dayKey} isToday={todayFlag}>
                    {itemsContent}
                  </AllDayDropZone>
                );
              }

              return (
                <div
                  key={dayKey}
                  className={`min-h-[32px] p-0.5 border-r border-gray-100 last:border-r-0 ${
                    todayFlag ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {itemsContent}
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
          const todayFlag = isToday(day);

          return (
            <div
              key={dayKey}
              className="relative border-r border-gray-100 last:border-r-0"
            >
              {/* Hour grid lines / droppable slots */}
              {enableDragDrop ? (
                HOURS.map((hour) => (
                  <TimeSlot
                    key={hour}
                    dayKey={dayKey}
                    hour={hour}
                    isToday={todayFlag}
                  />
                ))
              ) : (
                HOURS.map((hour) => (
                  <div
                    key={hour}
                    className={`h-[50px] border-b border-gray-100 ${todayFlag ? 'bg-blue-50/30' : ''}`}
                  />
                ))
              )}

              {/* Events */}
              {timedItems.map((item) => {
                const style = getEventStyle(item);

                if (enableDragDrop && (item.type === 'task' || item.type === 'event')) {
                  return (
                    <DraggableEvent
                      key={item.id}
                      item={item}
                      style={style}
                      onClick={() => onEventClick?.(item)}
                      enableDrag={item.type === 'task' && item.isScheduled}
                    />
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => onEventClick?.(item)}
                    onMouseEnter={() => setHoveredEvent(item.id)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    className={`absolute left-0.5 right-0.5 px-1 py-0.5 text-xs rounded border overflow-hidden ${getEventColor(item)} hover:z-10 hover:shadow-md transition-shadow`}
                    style={style}
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
                );
              })}

              {/* Current time indicator */}
              {todayFlag && <CurrentTimeIndicator />}
            </div>
          );
        })}
          </div>
        </div>
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
