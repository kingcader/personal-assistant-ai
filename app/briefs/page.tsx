'use client';

import { useEffect, useState } from 'react';
import { getRecentBriefs, type DailyBrief } from '@/lib/supabase/notification-queries';

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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function getBriefContent(brief: DailyBrief): BriefContent | null {
    if (!brief.content) return null;
    return brief.content as unknown as BriefContent;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Daily Briefs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Morning and evening summaries
          </p>
        </div>

        {briefs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No briefs yet. Check back after 7 AM or 8 PM.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Brief List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {briefs.map((brief) => (
                  <button
                    key={brief.id}
                    onClick={() => setSelectedBrief(brief)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedBrief?.id === brief.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      brief.type === 'morning' ? 'bg-yellow-100' : 'bg-indigo-100'
                    }`}>
                      {brief.type === 'morning' ? (
                        <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {brief.type === 'morning' ? 'Morning' : 'Evening'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(brief.date)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brief Detail */}
            <div className="lg:col-span-2">
              {selectedBrief ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  {/* Brief Header */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedBrief.type === 'morning' ? 'bg-yellow-100' : 'bg-indigo-100'
                    }`}>
                      {selectedBrief.type === 'morning' ? (
                        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedBrief.type === 'morning' ? 'Morning Brief' : 'Evening Brief'}
                      </h2>
                      <p className="text-sm text-gray-500">{formatFullDate(selectedBrief.date)}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  {getBriefContent(selectedBrief)?.summary && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        {getBriefContent(selectedBrief)?.summary}
                      </p>
                    </div>
                  )}

                  {/* Sections */}
                  {getBriefContent(selectedBrief)?.sections?.map((section, idx) => (
                    <div key={idx} className="mb-5">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">
                        {section.title}
                      </h3>
                      {section.items.length > 0 ? (
                        <ul className="space-y-1.5">
                          {section.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400 italic">None</p>
                      )}
                    </div>
                  ))}

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
                    Generated {new Date(selectedBrief.generated_at).toLocaleString()}
                    {selectedBrief.ai_model_used && ` using ${selectedBrief.ai_model_used}`}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <p className="text-gray-500">Select a brief to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex gap-4">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Home
          </a>
          <a href="/tasks" className="text-sm text-blue-600 hover:text-blue-800">
            Tasks →
          </a>
        </div>
      </div>
    </div>
  );
}
