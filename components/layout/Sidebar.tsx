'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageCircle,
  CheckSquare,
  Calendar,
  ClipboardCheck,
  Clock,
  FileText,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  FolderKanban,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const primaryNavItems: NavItem[] = [
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/review', label: 'Review', icon: ClipboardCheck },
];

const secondaryNavItems: NavItem[] = [
  { href: '/waiting-on', label: 'Waiting On', icon: Clock },
  { href: '/briefs', label: 'Daily Briefs', icon: FileText },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function Sidebar() {
  const pathname = usePathname();
  const { toggleTheme, isDark, mounted } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState({
    review: 0,
    waitingOn: 0,
  });

  // Initialize collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    }
  }, []);

  // Fetch badge counts
  useEffect(() => {
    async function fetchBadges() {
      try {
        const [suggestionsRes, followUpsRes, threadsRes] = await Promise.all([
          fetch('/api/suggestions?status=pending'),
          fetch('/api/follow-ups?status=pending'),
          fetch('/api/threads?waiting_on=true'),
        ]);

        const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : [];
        const followUps = followUpsRes.ok ? await followUpsRes.json() : [];
        const threads = threadsRes.ok ? await threadsRes.json() : [];

        setBadges({
          review: suggestions.length + followUps.length,
          waitingOn: threads.length,
        });
      } catch {
        // Silently fail
      }
    }

    fetchBadges();
    const interval = setInterval(fetchBadges, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

  const getBadge = (href: string) => {
    if (href === '/review') return badges.review;
    if (href === '/waiting-on') return badges.waitingOn;
    return undefined;
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const badge = getBadge(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        <div className="relative">
          <Icon className="h-5 w-5 flex-shrink-0" />
          {badge !== undefined && badge > 0 && collapsed && (
            <span className="badge-ios absolute -right-1 -top-1 scale-75">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="badge-ios">{badge > 99 ? '99+' : badge}</span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      <div className="flex h-full flex-col">
        {/* Logo area */}
        <div className={`flex items-center h-14 border-b ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          {!collapsed && (
            <Link href="/chat" className="font-semibold text-lg text-primary">
              Assistant AI
            </Link>
          )}
          {collapsed && (
            <Link href="/chat" className="font-bold text-lg text-primary">
              AI
            </Link>
          )}
        </div>

        {/* Primary nav */}
        <nav className="flex-1 py-4 space-y-1">
          {primaryNavItems.map(renderNavItem)}

          {/* Separator */}
          <div className="my-4 mx-2 border-t" />

          {secondaryNavItems.map(renderNavItem)}
        </nav>

        {/* Bottom section */}
        <div className="border-t py-4 space-y-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`sidebar-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? (isDark ? 'Light Mode' : 'Dark Mode') : undefined}
          >
            {mounted && isDark ? (
              <Sun className="h-5 w-5 flex-shrink-0" />
            ) : (
              <Moon className="h-5 w-5 flex-shrink-0" />
            )}
            {!collapsed && (
              <span className="flex-1">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={`sidebar-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
