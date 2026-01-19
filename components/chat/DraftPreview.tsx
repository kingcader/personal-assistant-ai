'use client';

import { useState } from 'react';

interface DraftPreviewProps {
  subject: string;
  body: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  isReply?: boolean;
  onApprove: (editedDraft?: { subject?: string; body?: string }) => void;
  onEdit: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DraftPreview({
  subject,
  body,
  recipientEmail,
  recipientName,
  isReply = false,
  onApprove,
  onEdit,
  onCancel,
  isLoading = false,
}: DraftPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);

  const handleApprove = () => {
    if (isEditing) {
      onApprove({
        subject: editedSubject !== subject ? editedSubject : undefined,
        body: editedBody !== body ? editedBody : undefined,
      });
    } else {
      onApprove();
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedSubject(subject);
    setEditedBody(body);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedSubject(subject);
    setEditedBody(body);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span className="font-medium text-gray-900">
            {isReply ? 'Reply Draft' : 'Email Draft'}
          </span>
          {isEditing && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              Editing
            </span>
          )}
        </div>
      </div>

      {/* Draft Content */}
      <div className="p-4 space-y-3">
        {/* Recipient */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 font-medium w-16">To:</span>
          <span className="text-gray-900">
            {recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail || '[Recipient]'}
          </span>
        </div>

        {/* Subject */}
        <div className="flex items-start gap-2 text-sm">
          <span className="text-gray-500 font-medium w-16 pt-1">Subject:</span>
          {isEditing ? (
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <span className="text-gray-900">{subject}</span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-2" />

        {/* Body */}
        {isEditing ? (
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        ) : (
          <div className="text-sm text-gray-800 whitespace-pre-wrap">
            {body}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save & Send
                  </>
                )}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve & Send
                  </>
                )}
              </button>
              <button
                onClick={handleStartEdit}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </>
          )}
        </div>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
