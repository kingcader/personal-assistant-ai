'use client';

import { useState } from 'react';

interface Attendee {
  email: string | null;
  name: string;
}

interface EventPreviewProps {
  event: {
    summary: string;
    description: string | null;
    start_date: string;
    start_time: string;
    end_time: string | null;
    attendees: Attendee[];
    location: string | null;
  };
  onApprove: (event: {
    summary: string;
    description: string | null;
    start_time: string;
    end_time: string;
    attendees: Attendee[];
    location: string | null;
  }) => void;
  onEdit?: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function EventPreview({
  event,
  onApprove,
  onEdit,
  onCancel,
  isLoading = false,
}: EventPreviewProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedEvent, setEditedEvent] = useState(event);

  const formatDateTime = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const calculateEndTime = (startTime: string, durationMinutes: number = 60): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;

    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const handleApprove = () => {
    const endTime = editedEvent.end_time || calculateEndTime(editedEvent.start_time);
    const startDateTime = `${editedEvent.start_date}T${editedEvent.start_time}:00`;
    const endDateTime = `${editedEvent.start_date}T${endTime}:00`;

    onApprove({
      summary: editedEvent.summary,
      description: editedEvent.description,
      start_time: startDateTime,
      end_time: endDateTime,
      attendees: editedEvent.attendees,
      location: editedEvent.location,
    });
  };

  const addAttendee = () => {
    setEditedEvent({
      ...editedEvent,
      attendees: [...editedEvent.attendees, { email: null, name: '' }],
    });
  };

  const updateAttendee = (index: number, field: 'email' | 'name', value: string) => {
    const newAttendees = [...editedEvent.attendees];
    newAttendees[index] = {
      ...newAttendees[index],
      [field]: value || null,
    };
    setEditedEvent({ ...editedEvent, attendees: newAttendees });
  };

  const removeAttendee = (index: number) => {
    setEditedEvent({
      ...editedEvent,
      attendees: editedEvent.attendees.filter((_, i) => i !== index),
    });
  };

  if (editMode) {
    return (
      <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Edit Event</h4>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Event Title</label>
            <input
              type="text"
              value={editedEvent.summary}
              onChange={(e) => setEditedEvent({ ...editedEvent, summary: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editedEvent.description || ''}
              onChange={(e) => setEditedEvent({ ...editedEvent, description: e.target.value || null })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Optional description or agenda..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={editedEvent.start_date}
                onChange={(e) => setEditedEvent({ ...editedEvent, start_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={editedEvent.start_time}
                onChange={(e) => setEditedEvent({ ...editedEvent, start_time: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={editedEvent.end_time || calculateEndTime(editedEvent.start_time)}
                onChange={(e) => setEditedEvent({ ...editedEvent, end_time: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={editedEvent.location || ''}
              onChange={(e) => setEditedEvent({ ...editedEvent, location: e.target.value || null })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Meeting room, Zoom, etc..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">Attendees</label>
              <button
                type="button"
                onClick={addAttendee}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                + Add Attendee
              </button>
            </div>
            {editedEvent.attendees.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No attendees</p>
            ) : (
              <div className="space-y-2">
                {editedEvent.attendees.map((attendee, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={attendee.name}
                      onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Name"
                    />
                    <input
                      type="email"
                      value={attendee.email || ''}
                      onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Email (optional)"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleApprove}
            disabled={isLoading || !editedEvent.summary.trim()}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Save & Create
          </button>
          <button
            onClick={() => {
              setEditMode(false);
              setEditedEvent(event);
            }}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const endTime = event.end_time || calculateEndTime(event.start_time);

  return (
    <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h4 className="text-sm font-medium text-gray-900">{event.summary}</h4>
          </div>

          {event.description && (
            <p className="text-xs text-gray-600 mt-1 ml-7">{event.description}</p>
          )}

          <div className="mt-2 ml-7 space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatDateTime(event.start_date, event.start_time)}</span>
              <span>-</span>
              <span>{endTime}</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{event.location}</span>
              </div>
            )}

            {event.attendees.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>
                  {event.attendees.map(a => a.name || a.email).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Create Event
        </button>
        <button
          onClick={() => setEditMode(true)}
          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
