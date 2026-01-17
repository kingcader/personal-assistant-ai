'use client';

import { useState } from 'react';

export type CalendarItemType = 'event' | 'task' | 'suggestion';

export interface CalendarItemProps {
  type: CalendarItemType;
  id: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  allDay?: boolean;
  // Event-specific
  location?: string | null;
  meetingLink?: string | null;
  attendees?: { email: string; name: string | null }[];
  hasPrepPacket?: boolean;
  // Task-specific
  priority?: 'low' | 'med' | 'high';
  status?: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  description?: string | null;
  emailSubject?: string | null;
  isScheduled?: boolean;
  // Suggestion-specific
  reason?: string;
  taskTitle?: string;
  // Callbacks
  onComplete?: (id: string) => void;
  onStart?: (id: string) => void;
  onViewPrep?: (id: string) => void;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;
  onUnschedule?: (id: string) => void;
  onEdit?: (id: string) => void;
  isProcessing?: boolean;
}

export default function CalendarItem({
  type,
  id,
  title,
  startTime,
  endTime,
  allDay,
  location,
  meetingLink,
  attendees,
  hasPrepPacket,
  priority,
  status,
  description,
  emailSubject,
  isScheduled,
  reason,
  taskTitle,
  onComplete,
  onStart,
  onViewPrep,
  onAcceptSuggestion,
  onDismissSuggestion,
  onUnschedule,
  onEdit,
  isProcessing,
}: CalendarItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDuration = () => {
    if (!endTime || allDay) return null;
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getItemColor = () => {
    if (type === 'event') return 'border-l-purple-500 bg-purple-50';
    if (type === 'task') {
      if (priority === 'high') return 'border-l-red-500 bg-red-50';
      if (priority === 'med') return 'border-l-yellow-500 bg-yellow-50';
      return 'border-l-blue-500 bg-blue-50';
    }
    return 'border-l-gray-400 bg-gray-50 border-dashed';
  };

  const getPriorityBadge = () => {
    if (!priority) return null;
    const colors = {
      high: 'bg-red-100 text-red-700',
      med: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${colors[priority]}`}>
        {priority === 'med' ? 'Medium' : priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const getStatusBadge = () => {
    if (!status || status === 'todo') return null;
    const colors = {
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    const labels = {
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getIcon = () => {
    if (type === 'event') {
      return (
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    if (type === 'task') {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    }
    // Suggestion
    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-dashed border-gray-300">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
    );
  };

  return (
    <div className={`border-l-4 rounded-r-lg ${getItemColor()} ${type === 'suggestion' ? 'opacity-80' : ''}`}>
      {/* Compact row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {getIcon()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm text-gray-900 truncate ${status === 'completed' ? 'line-through text-gray-500' : ''}`}>
              {type === 'suggestion' ? `Suggested: ${taskTitle || title}` : title}
            </span>
            {hasPrepPacket && (
              <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {allDay ? 'All day' : formatTime(startTime)}
              {getDuration() && ` · ${getDuration()}`}
            </span>
            {location && (
              <span className="text-xs text-gray-400 truncate max-w-[150px]">
                · {location}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {getPriorityBadge()}
          {getStatusBadge()}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200/50">
          {/* Event details */}
          {type === 'event' && (
            <div className="space-y-2">
              {attendees && attendees.length > 0 && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Attendees:</span>{' '}
                  {attendees.map((a) => a.name || a.email).join(', ')}
                </div>
              )}
              {location && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Location:</span> {location}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                {meetingLink && (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Join Meeting
                  </a>
                )}
                {onViewPrep && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPrep(id);
                    }}
                    className="text-xs px-3 py-1.5 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200"
                  >
                    {hasPrepPacket ? 'View Prep' : 'Generate Prep'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Task details */}
          {type === 'task' && (
            <div className="space-y-2">
              {description && (
                <p className="text-xs text-gray-600">{description}</p>
              )}
              {emailSubject && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">From email:</span> {emailSubject}
                </div>
              )}
              {isScheduled && (
                <div className="text-xs text-blue-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Scheduled</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {status === 'todo' && onStart && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStart(id);
                    }}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Start
                  </button>
                )}
                {status !== 'completed' && onComplete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onComplete(id);
                    }}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
                {isScheduled && onUnschedule && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnschedule(id);
                    }}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Unschedule
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(id);
                    }}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Suggestion details */}
          {type === 'suggestion' && (
            <div className="space-y-2">
              {reason && (
                <p className="text-xs text-gray-600 italic">&ldquo;{reason}&rdquo;</p>
              )}
              <div className="flex gap-2 mt-3">
                {onAcceptSuggestion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcceptSuggestion(id);
                    }}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                )}
                {onDismissSuggestion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissSuggestion(id);
                    }}
                    disabled={isProcessing}
                    className="text-xs px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
