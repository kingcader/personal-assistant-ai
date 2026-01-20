'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  FileText,
  BookOpen,
  Settings,
  X,
  FolderKanban,
  Sun,
  Moon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface MoreMenuProps {
  open: boolean;
  onClose: () => void;
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const menuItems: MenuItem[] = [
  { href: '/waiting-on', label: 'Waiting On', icon: Clock },
  { href: '/briefs', label: 'Daily Briefs', icon: FileText },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MoreMenu({ open, onClose }: MoreMenuProps) {
  const pathname = usePathname();
  const { toggleTheme, isDark, mounted } = useTheme();
  const [waitingOnCount, setWaitingOnCount] = useState(0);

  // Fetch waiting-on count
  useEffect(() => {
    async function fetchWaitingOnCount() {
      try {
        const res = await fetch('/api/threads?waiting_on=true');
        if (res.ok) {
          const threads = await res.json();
          setWaitingOnCount(threads.length);
        }
      } catch {
        // Silently fail
      }
    }

    if (open) {
      fetchWaitingOnCount();
    }
  }, [open]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Menu sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] animate-in slide-in-from-bottom duration-300">
        <div className="bg-card rounded-t-3xl pb-safe">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4">
            <h2 className="text-lg font-semibold">More</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Menu items */}
          <div className="px-4 pb-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              const badge = item.href === '/waiting-on' ? waitingOnCount : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`list-item-ios ${isActive ? 'bg-primary/10 text-primary' : ''}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1 font-medium">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="badge-ios">{badge > 99 ? '99+' : badge}</span>
                  )}
                </Link>
              );
            })}

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="list-item-ios w-full"
            >
              {mounted && isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="flex-1 font-medium text-left">
                {mounted && isDark ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
