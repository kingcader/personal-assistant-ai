'use client';

import { useState, useCallback, useEffect } from 'react';
import { MessageSquare, ChevronLeft, History } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import ConversationList from '@/components/chat/ConversationList';

export default function ChatPage() {
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
    setShowHistory(false);
  }, []);

  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(undefined);
    setShowHistory(false);
  }, []);

  const handleConversationCreated = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
    setSidebarKey(prev => prev + 1);
  }, []);

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex bg-background">
      {/* Conversation History Sidebar - Desktop */}
      <aside className={`
        hidden md:flex flex-col
        w-80 border-r bg-card
        transition-all duration-300
      `}>
        <ConversationList
          key={sidebarKey}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />
      </aside>

      {/* Mobile History Sheet */}
      {isMobile && showHistory && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm bg-card animate-in slide-in-from-left duration-300">
            <div className="flex items-center gap-2 p-4 border-b">
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="font-semibold">Conversations</h2>
            </div>
            <div className="h-[calc(100%-60px)]">
              <ConversationList
                key={sidebarKey}
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card/95 backdrop-blur-xl">
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          >
            <History className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Assistant</h1>
              <p className="text-xs text-muted-foreground">Ask anything</p>
            </div>
          </div>
          <button
            onClick={handleNewConversation}
            className="btn-ios-secondary text-sm py-1.5 px-3"
          >
            New
          </button>
        </header>

        {/* Chat Panel */}
        <main className="flex-1 overflow-hidden">
          <ChatPanel
            className="h-full"
            conversationId={currentConversationId}
            onConversationCreated={handleConversationCreated}
          />
        </main>
      </div>
    </div>
  );
}
