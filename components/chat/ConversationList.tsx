'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Archive, Trash2, X } from 'lucide-react';
import type { ConversationWithPreview } from '@/types/database';

type Toast = {
  message: string;
  type: 'success' | 'error';
  action?: { label: string; onClick: () => void };
};

type PendingDelete = {
  conversation: ConversationWithPreview;
  timeoutId: NodeJS.Timeout;
};

interface ConversationListProps {
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (showArchived) params.set('includeArchived', 'true');

      const response = await fetch(`/api/conversations?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, showArchived]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleArchive = async (e: React.MouseEvent, conversationId: string, currentlyArchived: boolean) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: !currentlyArchived }),
      });
      fetchConversations();
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error', action?: { label: string; onClick: () => void }) => {
    setToast({ message, type, action });
    setTimeout(() => setToast(null), action ? 5000 : 3000);
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;

    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (conversationId === currentConversationId) {
      onNewConversation();
    }

    const timeoutId = setTimeout(async () => {
      pendingDeleteRef.current = null;
      try {
        await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Error deleting conversation:', error);
        setConversations((prev) => [conversation, ...prev].sort((a, b) =>
          new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime()
        ));
        showToast('Failed to delete conversation', 'error');
      }
    }, 5000);

    pendingDeleteRef.current = { conversation, timeoutId };
    showToast('Conversation deleted', 'success', {
      label: 'Undo',
      onClick: () => undoDelete(conversationId, conversation, timeoutId),
    });
  };

  const undoDelete = (conversationId: string, conversation: ConversationWithPreview, timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    pendingDeleteRef.current = null;
    setToast(null);
    setConversations((prev) => [conversation, ...prev].sort((a, b) =>
      new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime()
    ));
    showToast('Conversation restored', 'success');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const truncateText = (text: string | null, maxLength: number = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <button
          onClick={onNewConversation}
          className="w-full btn-ios-primary flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="input-ios pl-10"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary/20"
          />
          Show archived
        </label>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`
                  group relative rounded-xl p-3 cursor-pointer transition-all
                  ${conversation.id === currentConversationId
                    ? 'bg-primary/10'
                    : 'hover:bg-muted active:bg-muted/80'
                  }
                  ${conversation.is_archived ? 'opacity-60' : ''}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-medium truncate ${
                        conversation.id === currentConversationId ? 'text-primary' : ''
                      }`}>
                        {conversation.title || 'Untitled'}
                      </h3>
                      {conversation.is_archived && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {truncateText(conversation.last_user_message)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(conversation.last_message_at)}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-1 bg-card rounded-lg shadow-sm border p-1">
                  <button
                    onClick={(e) => handleArchive(e, conversation.id, conversation.is_archived)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title={conversation.is_archived ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, conversation.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t text-center">
        <p className="text-xs text-muted-foreground">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
          <div className={`
            rounded-xl px-4 py-3 shadow-lg text-sm flex items-center gap-3
            ${toast.type === 'success' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'}
          `}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="px-2 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                {toast.action.label}
              </button>
            )}
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
