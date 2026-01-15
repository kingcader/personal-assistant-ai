'use client';

import { useEffect, useState } from 'react';
import { getRecentBriefs, type DailyBrief } from '@/lib/supabase/notification-queries';
import Link from 'next/link';

interface BriefContent {
  summary: string;
  sections: Array<{
    title: string;
    items: string[];
  }>;
  raw_data?: Record<string, unknown>;
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<DailyBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrief, setSelectedBrief] = useState<DailyBrief | null>(null);

  useEffect(() => {
    loadBriefs();
  }, []);

  async function loadBriefs() {
    try {
      const data = await getRecentBriefs(30);
      setBriefs(data);
      if (data.length > 0) {
        setSelectedBrief(data[0]);
      }
    } catch (error) {
      console.error('Failed to load briefs:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatBriefType(type: string): string {
    return type === 'morning' ? 'Morning Brief' : 'Evening Brief';
  }

  function getBriefIcon(type: string): string {
    return type === 'morning' ? '🌅' : '🌙';
  }

  function getBriefContent(brief: DailyBrief): BriefContent | null {
    if (!brief.content) return null;
    return brief.content as unknown as BriefContent;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading briefs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-3xl font-bold">Daily Briefs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Morning and evening reports summarizing your tasks and activity
          </p>
          <div className="mt-3">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {briefs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No briefs generated yet. Check back after 7 AM or 8 PM.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Brief List */}
            <div className="lg:col-span-1">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Briefs</h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {briefs.map((brief) => (
                  <button
                    key={brief.id}
                    onClick={() => setSelectedBrief(brief)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedBrief?.id === brief.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border bg-card hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getBriefIcon(brief.type)}</span>
                      <div>
                        <div className="font-medium text-foreground">
                          {formatBriefType(brief.type)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(brief.date)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brief Detail */}
            <div className="lg:col-span-2">
              {selectedBrief ? (
                <div className="rounded-lg border border-border bg-card p-6">
                  {/* Brief Header */}
                  <div className="mb-6 flex items-center gap-3">
                    <span className="text-3xl">{getBriefIcon(selectedBrief.type)}</span>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {formatBriefType(selectedBrief.type)}
                      </h2>
                      <p className="text-muted-foreground">
                        {formatDate(selectedBrief.date)}
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  {getBriefContent(selectedBrief)?.summary && (
                    <div className="mb-6 rounded-lg bg-muted/50 p-4">
                      <p className="text-foreground">
                        {getBriefContent(selectedBrief)?.summary}
                      </p>
                    </div>
                  )}

                  {/* Sections */}
                  {getBriefContent(selectedBrief)?.sections?.map((section, idx) => (
                    <div key={idx} className="mb-6">
                      <h3 className="mb-3 text-lg font-semibold text-foreground">
                        {section.title}
                      </h3>
                      {section.items.length > 0 ? (
                        <ul className="space-y-2">
                          {section.items.map((item, itemIdx) => (
                            <li
                              key={itemIdx}
                              className="flex items-start gap-2 text-foreground"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">None</p>
                      )}
                    </div>
                  ))}

                  {/* Generated timestamp */}
                  <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                    Generated: {new Date(selectedBrief.generated_at).toLocaleString()}
                    {selectedBrief.ai_model_used && (
                      <span className="ml-2">• Model: {selectedBrief.ai_model_used}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-12 text-center">
                  <p className="text-muted-foreground">
                    Select a brief to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
