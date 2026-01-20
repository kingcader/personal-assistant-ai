'use client';

import { useState, useCallback, useEffect } from 'react';
import MessageList, { Message } from './MessageList';
import MessageInput from './MessageInput';

interface ChatResponse {
  success: boolean;
  response: string;
  type: 'answer' | 'draft' | 'agenda' | 'info' | 'general' | 'search_results';
  citations?: Array<{
    fileName: string;
    sectionTitle: string | null;
    driveUrl: string;
    sourceUrl: string | null;
    excerpt: string;
    similarity: number;
    truthPriority: string | null;
  }>;
  confidence?: 'high' | 'medium' | 'low';
  action?: {
    type: string;
    status: string;
    data: Record<string, unknown>;
  };
  searchResults?: Array<{
    id: string;
    subject: string;
    snippet: string;
    sender: string;
    senderEmail: string;
    date: string;
    threadId?: string;
  }>;
  intent?: {
    intent: string;
    confidence: string;
  };
  error?: string;
  messageId?: string;
  conversationId?: string;
}

interface ChatPanelProps {
  className?: string;
  conversationId?: string;
  onConversationCreated?: (conversationId: string) => void;
  onSendEmail?: (data: Record<string, unknown>) => Promise<void>;
}

export default function ChatPanel({
  className = '',
  conversationId,
  onConversationCreated,
  onSendEmail
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId);

      if (conversationId) {
        loadConversation(conversationId);
      } else {
        setMessages([]);
      }
    }
  }, [conversationId]);

  const loadConversation = async (convId: string) => {
    setIsLoadingConversation(true);
    try {
      const response = await fetch(`/api/conversations/${convId}`);
      const data = await response.json();

      if (data.success && data.messages) {
        const uiMessages: Message[] = data.messages.map((m: {
          id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
          type?: string;
          citations?: Array<{
            fileName: string;
            sectionTitle: string | null;
            driveUrl: string;
            sourceUrl: string | null;
            excerpt: string;
            similarity: number;
            truthPriority: string | null;
          }>;
          confidence?: 'high' | 'medium' | 'low';
          action?: {
            type: string;
            status: string;
            data: Record<string, unknown>;
          };
          search_results?: Array<{
            id: string;
            subject: string;
            snippet: string;
            sender: string;
            senderEmail: string;
            date: string;
            threadId?: string;
          }>;
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          type: m.type as Message['type'],
          citations: m.citations,
          confidence: m.confidence,
          action: m.action,
          searchResults: m.search_results,
        }));
        setMessages(uiMessages);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId: currentConversationId,
        }),
      });

      const data: ChatResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      if (data.conversationId && data.conversationId !== currentConversationId) {
        setCurrentConversationId(data.conversationId);
        if (onConversationCreated) {
          onConversationCreated(data.conversationId);
        }
      }

      const assistantMessage: Message = {
        id: data.messageId || generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        type: data.type,
        citations: data.citations,
        confidence: data.confidence,
        action: data.action,
        searchResults: data.searchResults,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');

      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
        type: 'general',
        confidence: 'low',
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, onConversationCreated]);

  const handleApproveAction = useCallback(async (messageId: string, editedDraft?: { subject?: string; body?: string }) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message?.action) return;

    setActionLoadingId(messageId);

    try {
      const actionData = { ...message.action.data };
      if (editedDraft?.subject) {
        actionData.subject = editedDraft.subject;
      }
      if (editedDraft?.body) {
        actionData.body = editedDraft.body;
      }

      const response = await fetch('/api/chat/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: message.action.type,
          actionData,
          messageId,
          conversationId: currentConversationId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Action failed');
      }

      let confirmContent = '';
      if (message.action.type === 'send_email') {
        confirmContent = `Email sent successfully to ${message.action.data.recipient_email || 'the recipient'}.`;
      } else if (message.action.type === 'create_task') {
        confirmContent = `Task "${data.task?.title || 'task'}" created successfully.`;
      } else if (message.action.type === 'create_event') {
        confirmContent = `Event "${data.event?.summary || 'event'}" created successfully.`;
      }

      const confirmMessage: Message = {
        id: data.messageId || generateId(),
        role: 'assistant',
        content: confirmContent,
        timestamp: new Date(),
        type: 'info',
        confidence: 'high',
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, action: undefined }
            : m
        ).concat(confirmMessage)
      );

      if (onSendEmail && message.action.type === 'send_email') {
        await onSendEmail(message.action.data);
      }
    } catch (err) {
      console.error('Approve action error:', err);

      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
        type: 'info',
        confidence: 'low',
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setActionLoadingId(null);
    }
  }, [messages, currentConversationId, onSendEmail]);

  const handleEditAction = useCallback(() => {
    // DraftPreview handles editing internally
  }, []);

  const handleCancelAction = useCallback(async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, action: undefined }
          : m
      )
    );

    const cancelMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: 'Action cancelled. Let me know if you\'d like me to help with something else.',
      timestamp: new Date(),
      type: 'info',
      confidence: 'high',
    };

    setMessages((prev) => [...prev, cancelMessage]);
  }, []);

  if (isLoadingConversation) {
    return (
      <div className={`flex flex-col h-full bg-background items-center justify-center ${className}`}>
        <div className="animate-pulse space-y-3 w-64">
          <div className="h-4 bg-muted rounded-full w-3/4"></div>
          <div className="h-4 bg-muted rounded-full w-1/2"></div>
          <div className="h-4 bg-muted rounded-full w-2/3"></div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onApproveAction={handleApproveAction}
        onEditAction={handleEditAction}
        onCancelAction={handleCancelAction}
        onSuggestionClick={sendMessage}
        actionLoadingId={actionLoadingId}
      />

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
      />
    </div>
  );
}
