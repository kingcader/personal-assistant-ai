'use client';

import { useState } from 'react';
import { User, Monitor, BookOpen, ChevronRight } from 'lucide-react';
import EmailSearchResults from './EmailSearchResults';
import DraftPreview from './DraftPreview';

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

interface Citation {
  fileName: string;
  sectionTitle: string | null;
  driveUrl: string;
  sourceUrl: string | null;
  excerpt: string;
  similarity: number;
  truthPriority: string | null;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  type?: 'answer' | 'draft' | 'agenda' | 'info' | 'general' | 'search_results';
  citations?: Citation[];
  confidence?: 'high' | 'medium' | 'low';
  isLoading?: boolean;
  action?: {
    type: string;
    status: string;
    data: Record<string, unknown>;
  };
  searchResults?: EmailResult[];
  onApproveAction?: (editedDraft?: { subject?: string; body?: string }) => void;
  onEditAction?: () => void;
  onCancelAction?: () => void;
  isActionLoading?: boolean;
}

export default function ChatMessage({
  role,
  content,
  timestamp,
  type,
  citations,
  confidence,
  isLoading = false,
  action,
  searchResults,
  onApproveAction,
  onEditAction,
  onCancelAction,
  isActionLoading = false,
}: ChatMessageProps) {
  const [showCitations, setShowCitations] = useState(false);

  const confidenceStyles = {
    high: 'bg-success/10 text-success',
    medium: 'bg-warning/10 text-warning',
    low: 'bg-destructive/10 text-destructive',
  };

  const priorityColors: Record<string, string> = {
    standard: 'bg-muted text-muted-foreground',
    high: 'bg-warning/10 text-warning',
    authoritative: 'bg-success/10 text-success',
  };

  const formatContent = (text: string) => {
    const paragraphs = text.split(/\n\n+/);

    return paragraphs.map((paragraph, pIdx) => {
      if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
        const items = paragraph.split(/\n/).filter(Boolean);
        return (
          <ul key={pIdx} className="list-disc list-inside space-y-1 my-2">
            {items.map((item, iIdx) => (
              <li key={iIdx} className="text-sm">
                {formatInline(item.replace(/^[-*]\s+/, ''))}
              </li>
            ))}
          </ul>
        );
      }

      if (paragraph.startsWith('**') && paragraph.includes('**:')) {
        return (
          <p key={pIdx} className="text-sm font-medium my-2">
            {formatInline(paragraph)}
          </p>
        );
      }

      return (
        <p key={pIdx} className="text-sm my-1">
          {formatInline(paragraph)}
        </p>
      );
    });
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[Source:[^\]]+\])/g);

    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('[Source:')) {
        return (
          <span
            key={idx}
            className="text-primary text-xs cursor-help"
            title="Source citation"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 p-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
          <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
        </div>
        <div className="flex-1">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded-full w-3/4"></div>
            <div className="h-4 bg-muted rounded-full w-1/2"></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Thinking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 p-4 ${role === 'user' ? 'bg-muted/30' : 'bg-background'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          role === 'user'
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
        }`}
      >
        {role === 'user' ? (
          <User className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm">
            {role === 'user' ? 'You' : 'Assistant'}
          </span>
          {confidence && role === 'assistant' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-lg ${confidenceStyles[confidence]}`}>
              {confidence}
            </span>
          )}
          {type && role === 'assistant' && type !== 'general' && (
            <span className="text-xs px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary">
              {type}
            </span>
          )}
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {timestamp.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="text-foreground">{formatContent(content)}</div>

        {/* Email draft preview with edit capability */}
        {action && action.type === 'send_email' && (
          <div className="mt-4">
            <DraftPreview
              subject={(action.data.subject as string) || ''}
              body={(action.data.body as string) || ''}
              recipientEmail={action.data.recipient_email as string}
              recipientName={action.data.recipient_name as string}
              isReply={action.data.is_reply as boolean}
              onApprove={(editedDraft) => onApproveAction?.(editedDraft)}
              onEdit={onEditAction || (() => {})}
              onCancel={onCancelAction || (() => {})}
              isLoading={isActionLoading}
            />
          </div>
        )}

        {/* Email search results */}
        {searchResults && searchResults.length > 0 && (
          <EmailSearchResults results={searchResults} totalCount={searchResults.length} />
        )}

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>
                {citations.length} source{citations.length !== 1 ? 's' : ''}
              </span>
              <ChevronRight className={`w-3 h-3 transition-transform ${showCitations ? 'rotate-90' : ''}`} />
            </button>

            {showCitations && (
              <div className="mt-2 space-y-2">
                {citations.map((citation, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-xl text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href={citation.driveUrl || citation.sourceUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline truncate block"
                        >
                          {citation.fileName}
                        </a>
                        {citation.sectionTitle && (
                          <span className="text-xs text-muted-foreground">{citation.sectionTitle}</span>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{citation.excerpt}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{Math.round(citation.similarity * 100)}%</span>
                        {citation.truthPriority && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-lg ${
                              priorityColors[citation.truthPriority] || priorityColors.standard
                            }`}
                          >
                            {citation.truthPriority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
