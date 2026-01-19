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

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Load conversation messages when conversationId changes
  useEffect(() => {
    if (conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId);

      if (conversationId) {
        loadConversation(conversationId);
      } else {
        // New conversation, clear messages
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
        // Convert DB messages to UI messages
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

    // Add user message optimistically
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

      // If a new conversation was created, notify parent
      if (data.conversationId && data.conversationId !== currentConversationId) {
        setCurrentConversationId(data.conversationId);
        if (onConversationCreated) {
          onConversationCreated(data.conversationId);
        }
      }

      // Add assistant message
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

      // Add error message
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

  const handleApproveAction = useCallback(async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message?.action) return;

    setIsLoading(true);

    try {
      // Call approval endpoint
      const response = await fetch('/api/chat/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: message.action.type,
          actionData: message.action.data,
          messageId,
          conversationId: currentConversationId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Action failed');
      }

      // Add confirmation message
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

      // Update the original message to remove action buttons
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, action: undefined }
            : m
        ).concat(confirmMessage)
      );

      // Call external handler if provided
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
      setIsLoading(false);
    }
  }, [messages, currentConversationId, onSendEmail]);

  const handleEditAction = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message?.action) return;

    // For now, just add a note that editing will be available
    // In a full implementation, this would open an edit modal
    const editMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: 'Editing is not yet available. Please provide instructions for how you\'d like me to modify the draft.',
      timestamp: new Date(),
      type: 'info',
      confidence: 'medium',
    };

    setMessages((prev) => [...prev, editMessage]);
  }, [messages]);

  const handleCancelAction = useCallback(async (messageId: string) => {
    // Update the action status locally
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, action: undefined }
          : m
      )
    );

    // Add cancellation confirmation
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
      <div className={`flex flex-col h-full bg-white items-center justify-center ${className}`}>
        <div className="animate-pulse space-y-3 w-64">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onApproveAction={handleApproveAction}
        onEditAction={handleEditAction}
        onCancelAction={handleCancelAction}
      />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSend={sendMessage}
        disabled={isLoading}
      />
    </div>
  );
}
