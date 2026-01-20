'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Ask a question or type a request...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-card/95 backdrop-blur-xl p-4 pb-safe">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-secondary rounded-2xl resize-none
                focus:outline-none focus:ring-2 focus:ring-primary/20
                disabled:bg-muted disabled:cursor-not-allowed
                placeholder:text-muted-foreground text-foreground
                transition-all duration-200"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              className={`
                absolute right-2 bottom-2 p-2 rounded-xl transition-all duration-200
                ${message.trim() && !disabled
                  ? 'bg-primary text-primary-foreground hover:brightness-110 active:scale-95'
                  : 'text-muted-foreground cursor-not-allowed'
                }
              `}
              title="Send message (Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="hidden sm:inline">Enter to send, Shift+Enter for new line</span>
          <span className="sm:hidden">Tap to send</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSend("What's on my plate today?")}
              disabled={disabled}
              className="hover:text-primary transition-colors disabled:hover:text-muted-foreground"
            >
              Agenda
            </button>
            <button
              onClick={() => onSend('Help')}
              disabled={disabled}
              className="hover:text-primary transition-colors disabled:hover:text-muted-foreground"
            >
              Help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
