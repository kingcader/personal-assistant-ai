'use client';

import { useState } from 'react';

export interface PrepPacketData {
  id: string;
  event_id: string;
  content: {
    meeting: {
      summary: string | null;
      time: string;
      attendees: string[];
      location: string | null;
    };
    related_tasks: {
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
    }[];
    related_emails: {
      id: string;
      subject: string;
      from: string;
      snippet: string;
      date: string;
      thread_id: string;
    }[];
    waiting_on: {
      thread_id: string;
      subject: string;
      days_waiting: number;
      waiting_on_email: string;
    }[];
    talking_points: string[];
    ai_summary: string;
  };
  generated_at: string;
  regenerated_count: number;
}

interface PrepPacketProps {
  packet: PrepPacketData;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onClose?: () => void;
}

export default function PrepPacket({
  packet,
  onRegenerate,
  isRegenerating,
  onClose,
}: PrepPacketProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['talking_points', 'related_tasks'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const { content } = packet;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" />
            </svg>
            <h3 className="font-medium text-purple-900">Meeting Prep Packet</h3>
          </div>
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50"
              >
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {content.ai_summary && (
          <p className="text-sm text-purple-800 mt-2 italic">
            {content.ai_summary}
          </p>
        )}

        {/* Meeting Info */}
        <div className="mt-2 text-xs text-purple-700 space-y-1">
          <div>
            <span className="font-medium">Time:</span> {formatDate(content.meeting.time)}
          </div>
          {content.meeting.attendees.length > 0 && (
            <div>
              <span className="font-medium">Attendees:</span>{' '}
              {content.meeting.attendees.join(', ')}
            </div>
          )}
          {content.meeting.location && (
            <div>
              <span className="font-medium">Location:</span> {content.meeting.location}
            </div>
          )}
        </div>
      </div>

      {/* Talking Points */}
      <div className="border-b border-gray-100">
        <button
          onClick={() => toggleSection('talking_points')}
          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <span className="text-sm font-medium text-gray-700">
            Talking Points ({content.talking_points.length})
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expandedSections.has('talking_points') ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSections.has('talking_points') && content.talking_points.length > 0 && (
          <ul className="px-4 pb-3 space-y-1.5">
            {content.talking_points.map((point, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                {point}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Related Tasks */}
      <div className="border-b border-gray-100">
        <button
          onClick={() => toggleSection('related_tasks')}
          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <span className="text-sm font-medium text-gray-700">
            Related Tasks ({content.related_tasks.length})
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expandedSections.has('related_tasks') ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSections.has('related_tasks') && content.related_tasks.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {content.related_tasks.map((task) => (
              <a
                key={task.id}
                href={`/tasks?id=${task.id}`}
                className="block p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    task.priority === 'high' ? 'bg-red-500' :
                    task.priority === 'med' ? 'bg-yellow-500' : 'bg-blue-400'
                  }`} />
                  <span className="text-sm text-gray-900 flex-1">{task.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    task.status === 'completed' ? 'bg-green-100 text-green-700' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {task.status === 'in_progress' ? 'In Progress' :
                     task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
        {expandedSections.has('related_tasks') && content.related_tasks.length === 0 && (
          <p className="px-4 pb-3 text-sm text-gray-500 italic">No related tasks found</p>
        )}
      </div>

      {/* Related Emails */}
      <div className="border-b border-gray-100">
        <button
          onClick={() => toggleSection('related_emails')}
          className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50"
        >
          <span className="text-sm font-medium text-gray-700">
            Related Emails ({content.related_emails.length})
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              expandedSections.has('related_emails') ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSections.has('related_emails') && content.related_emails.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {content.related_emails.map((email) => (
              <div
                key={email.id}
                className="p-2 rounded bg-gray-50"
              >
                <div className="text-sm font-medium text-gray-900">{email.subject}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  From: {email.from} · {new Date(email.date).toLocaleDateString()}
                </div>
                {email.snippet && (
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">{email.snippet}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {expandedSections.has('related_emails') && content.related_emails.length === 0 && (
          <p className="px-4 pb-3 text-sm text-gray-500 italic">No related emails found</p>
        )}
      </div>

      {/* Waiting On */}
      {content.waiting_on.length > 0 && (
        <div className="border-b border-gray-100">
          <button
            onClick={() => toggleSection('waiting_on')}
            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-700">
              Waiting On ({content.waiting_on.length})
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                expandedSections.has('waiting_on') ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.has('waiting_on') && (
            <div className="px-4 pb-3 space-y-2">
              {content.waiting_on.map((item) => (
                <a
                  key={item.thread_id}
                  href={`/waiting-on?thread=${item.thread_id}`}
                  className="block p-2 rounded bg-yellow-50 hover:bg-yellow-100 transition-colors"
                >
                  <div className="text-sm text-gray-900">{item.subject}</div>
                  <div className="text-xs text-yellow-700 mt-0.5">
                    Waiting on {item.waiting_on_email} · {item.days_waiting} days
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
        Generated {formatDate(packet.generated_at)}
        {packet.regenerated_count > 0 && ` · Regenerated ${packet.regenerated_count}x`}
      </div>
    </div>
  );
}
