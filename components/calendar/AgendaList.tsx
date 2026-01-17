'use client';

import CalendarItem, { CalendarItemProps } from './CalendarItem';

interface CalendarDay {
  date: Date;
  label: string;
  items: CalendarItemProps[];
}

interface AgendaListProps {
  days: CalendarDay[];
  onTaskComplete?: (id: string) => void;
  onTaskStart?: (id: string) => void;
  onViewPrep?: (id: string) => void;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;
  processingIds?: Set<string>;
}

export default function AgendaList({
  days,
  onTaskComplete,
  onTaskStart,
  onViewPrep,
  onAcceptSuggestion,
  onDismissSuggestion,
  processingIds = new Set(),
}: AgendaListProps) {
  if (days.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-500">No items in this time range</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <div key={day.label}>
          {/* Day Header */}
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-medium text-gray-700">{day.label}</h2>
            <span className="text-xs text-gray-400">
              {day.items.length} {day.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {day.items.map((item) => (
              <CalendarItem
                key={`${item.type}-${item.id}`}
                {...item}
                onComplete={onTaskComplete}
                onStart={onTaskStart}
                onViewPrep={onViewPrep}
                onAcceptSuggestion={onAcceptSuggestion}
                onDismissSuggestion={onDismissSuggestion}
                isProcessing={processingIds.has(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
