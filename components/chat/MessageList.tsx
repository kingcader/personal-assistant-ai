'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
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
  onApproveAction?: (messageId: string, editedDraft?: { subject?: string; body?: string }) => void;
  onEditAction?: (messageId: string) => void;
  onCancelAction?: (messageId: string) => void;
  onSuggestionClick?: (message: string) => void;
  actionLoadingId?: string | null;
}

const QUICK_ACTIONS = [
  { label: "What's on my plate today?", icon: "calendar" },
  { label: "What are the payment terms?", icon: "document" },
  { label: "Draft a follow-up email", icon: "mail" },
  { label: "Search my emails", icon: "search" },
];

export default function MessageList({
  messages,
  isLoading = false,
  onApproveAction,
  onEditAction,
  onCancelAction,
  onSuggestionClick,
  actionLoadingId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          {/* Logo/Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </div>

          {/* Welcome text */}
          <h2 className="text-2xl font-semibold mb-2">
            Hi! I'm your assistant.
          </h2>
          <p className="text-muted-foreground mb-8">
            I can help with documents, tasks, calendar, and communications.
          </p>

          {/* Quick actions */}
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(action.label)}
                className="w-full card-ios text-left flex items-center gap-3 hover:bg-muted/50 transition-colors active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-hide"
    >
      <div className="divide-y divide-border/50">
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
                ? (editedDraft) => onApproveAction(message.id, editedDraft)
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
            isActionLoading={actionLoadingId === message.id}
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
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
