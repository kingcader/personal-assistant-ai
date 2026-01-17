/**
 * Accept Scheduling Suggestion API
 *
 * Marks a scheduling suggestion as accepted
 *
 * Part of Loop #4: AI-Powered Productivity Calendar
 */

import { NextRequest, NextResponse } from 'next/server';
import { acceptSchedulingSuggestion } from '@/lib/supabase/calendar-queries';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ suggestionId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { suggestionId } = await context.params;

    const suggestion = await acceptSchedulingSuggestion(suggestionId);

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error('Error accepting suggestion:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
