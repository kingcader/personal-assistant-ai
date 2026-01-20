'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';

interface AppShellProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppShell({ children }: AppShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Detect mobile/desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    setMounted(true);

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync sidebar collapsed state
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setSidebarCollapsed(stored === 'true');
    };

    // Initial load
    handleStorageChange();

    // Listen for changes from sidebar component
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event for same-tab updates
    const handleCustomEvent = () => handleStorageChange();
    window.addEventListener('sidebar-toggle', handleCustomEvent);

    // Poll for changes (fallback for same-tab localStorage changes)
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebar-toggle', handleCustomEvent);
      clearInterval(interval);
    };
  }, []);

  // Prevent flash of wrong layout
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <main className="min-h-screen">
          {children}
        </main>
        <BottomTabBar />
      </div>
    );
  }

  // Desktop layout with sidebar
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? '4rem' : '16rem',
        }}
      >
        {children}
      </main>
    </div>
  );
}
