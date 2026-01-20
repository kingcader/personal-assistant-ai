'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageCircle,
  CheckSquare,
  Calendar,
  ClipboardCheck,
  MoreHorizontal,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { MoreMenu } from './MoreMenu';

interface TabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const tabs: TabItem[] = [
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/review', label: 'Review', icon: ClipboardCheck },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [reviewBadge, setReviewBadge] = useState(0);

  // Fetch review count for badge
  useEffect(() => {
    async function fetchReviewCount() {
      try {
        const [suggestionsRes, followUpsRes] = await Promise.all([
          fetch('/api/suggestions?status=pending'),
          fetch('/api/follow-ups?status=pending'),
        ]);

        const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : [];
        const followUps = followUpsRes.ok ? await followUpsRes.json() : [];

        setReviewBadge(suggestions.length + followUps.length);
      } catch {
        // Silently fail
      }
    }

    fetchReviewCount();
    const interval = setInterval(fetchReviewCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if current path matches a "more" menu item
  const isMoreActive = ['/waiting-on', '/briefs', '/knowledge-base', '/settings', '/projects'].some(
    (path) => pathname.startsWith(path)
  );

  return (
    <>
      <nav className="tab-bar">
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            const Icon = tab.icon;
            const badge = tab.href === '/review' ? reviewBadge : undefined;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`tab-item ${isActive ? 'active' : ''}`}
              >
                <div className="relative">
                  <Icon className="tab-icon" />
                  {badge !== undefined && badge > 0 && (
                    <span className="badge-ios absolute -right-2 -top-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className="tab-label">{tab.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreMenuOpen(true)}
            className={`tab-item ${isMoreActive ? 'active' : ''}`}
          >
            <MoreHorizontal className="tab-icon" />
            <span className="tab-label">More</span>
          </button>
        </div>
      </nav>

      <MoreMenu open={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} />
    </>
  );
}
