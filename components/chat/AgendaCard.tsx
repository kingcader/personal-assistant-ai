'use client';

import Link from 'next/link';

interface AgendaCardProps {
  summary: string;
  meetings: {
    count: number;
    firstMeeting: string | null;
    highlights: string[];
  };
  tasks: {
    totalDue: number;
    highPriority: number;
    highlights: string[];
  };
  waitingOn: {
    count: number;
    urgent: string[];
  };
  pendingApprovals: {
    count: number;
    types: string[];
  };
  priorityFocus: string;
  suggestedActions: string[];
}

export default function AgendaCard({
  summary,
  meetings,
  tasks,
  waitingOn,
  pendingApprovals,
  priorityFocus,
  suggestedActions,
}: AgendaCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <span className="font-medium text-gray-900">Today's Agenda</span>
        </div>
        {summary && (
          <p className="mt-2 text-sm text-gray-600">{summary}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
        {/* Meetings */}
        <Link href="/calendar" className="bg-white p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{meetings.count}</p>
              <p className="text-xs text-gray-500">Meetings</p>
            </div>
          </div>
        </Link>

        {/* Tasks */}
        <Link href="/tasks" className="bg-white p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{tasks.totalDue}</p>
              <p className="text-xs text-gray-500">Tasks Due</p>
            </div>
          </div>
        </Link>

        {/* Waiting On */}
        <Link href="/waiting-on" className="bg-white p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{waitingOn.count}</p>
              <p className="text-xs text-gray-500">Waiting On</p>
            </div>
          </div>
        </Link>

        {/* Pending Approvals */}
        <Link href="/review" className="bg-white p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{pendingApprovals.count}</p>
              <p className="text-xs text-gray-500">Approvals</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        {/* First Meeting */}
        {meetings.firstMeeting && (
          <div className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">First Meeting</p>
              <p className="text-sm text-gray-600">{meetings.firstMeeting}</p>
            </div>
          </div>
        )}

        {/* High Priority Tasks */}
        {tasks.highPriority > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-red-500 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">{tasks.highPriority} High Priority</p>
              <p className="text-sm text-gray-600">Tasks that need attention</p>
            </div>
          </div>
        )}

        {/* Urgent Waiting On */}
        {waitingOn.urgent.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">Urgent Threads</p>
              <ul className="text-sm text-gray-600 list-disc list-inside">
                {waitingOn.urgent.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="truncate">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Priority Focus */}
        {priorityFocus && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm font-medium text-blue-900">Priority Focus</p>
            <p className="text-sm text-blue-700 mt-1">{priorityFocus}</p>
          </div>
        )}

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">Suggested Actions</p>
            <ul className="space-y-1">
              {suggestedActions.map((action, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
