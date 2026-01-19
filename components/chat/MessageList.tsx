'use client';

import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';

interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

interface EmailResult {
  id: string;
  subject: string;
  snippet: string;
  sender: string;
  senderEmail: string;
  date: string;
  threadId?: string;
  hasAttachments?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'answer' | 'draft' | 'agenda' | 'info' | 'general' | 'search_results';
  citations?: Citation[];
  confidence?: 'high' | 'medium' | 'low';
  action?: {
    type: string;
    status: string;
    data: Record<string, unknown>;
  };
  searchResults?: EmailResult[];
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onApproveAction?: (messageId: string) => void;
  onEditAction?: (messageId: string) => void;
  onCancelAction?: (messageId: string) => void;
}

export default function MessageList({
  messages,
  isLoading = false,
  onApproveAction,
  onEditAction,
  onCancelAction,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Hi! I'm your assistant.
          </h2>
          <p className="text-gray-600 mb-6">
            I can help you with your documents, tasks, calendar, and communications.
            Try asking me something!
          </p>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 font-medium">Try these:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "What's on my plate today?",
                'What are the payment terms in the contract?',
                'Write a follow-up to Sarah',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors"
                  onClick={() => {
                    // This would need to be connected to the parent component
                    // For now, just log it
                    console.log('Suggestion clicked:', suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
    >
      <div className="divide-y divide-gray-100">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            type={message.type}
            citations={message.citations}
            confidence={message.confidence}
            action={message.action}
            searchResults={message.searchResults}
            onApproveAction={
              message.action && onApproveAction
                ? () => onApproveAction(message.id)
                : undefined
            }
            onEditAction={
              message.action && onEditAction
                ? () => onEditAction(message.id)
                : undefined
            }
            onCancelAction={
              message.action && onCancelAction
                ? () => onCancelAction(message.id)
                : undefined
            }
          />
        ))}
        {isLoading && (
          <ChatMessage
            role="assistant"
            content=""
            isLoading={true}
          />
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
