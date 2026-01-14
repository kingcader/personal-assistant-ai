/**
 * Follow-up Generation API
 *
 * Generates an AI-drafted follow-up email for a stalled thread.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * Usage: POST /api/follow-ups/generate/:threadId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getThreadWithEmails, createFollowUpSuggestion } from '@/lib/supabase/thread-queries';
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpUserMessage,
  validateFollowUpResult,
} from '@/lib/ai/follow-up-prompt';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ threadId: string }>;
}

/**
 * Generate a follow-up email draft for a thread
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { threadId } = await params;

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    console.log(`🔄 Generating follow-up for thread: ${threadId}`);

    // 1. Get thread with all emails for context
    const thread = await getThreadWithEmails(threadId);

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    if (!thread.waiting_on_email) {
      return NextResponse.json(
        { error: 'Thread is not in waiting-on status' },
        { status: 400 }
      );
    }

    // 2. Calculate days waiting
    const daysWaiting = thread.waiting_since
      ? Math.floor(
          (Date.now() - new Date(thread.waiting_since).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

    // 3. Build AI prompt
    const userMessage = buildFollowUpUserMessage({
      subject: thread.subject,
      waitingOnEmail: thread.waiting_on_email,
      waitingSince: thread.waiting_since,
      daysWaiting,
      emails: thread.emails.map((e) => ({
        sender_email: e.sender.email,
        body: e.body,
        received_at: e.received_at,
      })),
    });

    // 4. Call AI for follow-up generation
    const aiProvider = (process.env.AI_PROVIDER || 'openai') as 'openai' | 'anthropic';
    const aiResponse = await generateWithAI(userMessage, aiProvider);

    console.log('🤖 AI response:', JSON.stringify(aiResponse, null, 2));

    // 5. Validate AI response
    const validatedResult = validateFollowUpResult(aiResponse);

    if (!validatedResult) {
      return NextResponse.json(
        { error: 'Failed to generate valid follow-up' },
        { status: 500 }
      );
    }

    // 6. Create follow-up suggestion in database
    const suggestion = await createFollowUpSuggestion({
      thread_id: threadId,
      suggested_action: 'follow_up',
      draft_subject: validatedResult.subject,
      draft_body: validatedResult.body,
      tone: validatedResult.tone,
      ai_model_used: aiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet',
      ai_reasoning: validatedResult.reasoning,
      status: 'pending',
    });

    console.log(`✅ Created follow-up suggestion: ${suggestion.id}`);

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error('❌ Error generating follow-up:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Also support GET for easier testing/linking from UI
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return POST(request, { params });
}

/**
 * Generate follow-up using AI provider
 */
async function generateWithAI(
  userMessage: string,
  provider: 'openai' | 'anthropic'
): Promise<unknown> {
  if (provider === 'openai') {
    return await generateWithOpenAI(userMessage);
  } else {
    return await generateWithAnthropic(userMessage);
  }
}

/**
 * OpenAI follow-up generation
 */
async function generateWithOpenAI(userMessage: string): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return JSON.parse(content);
}

/**
 * Anthropic follow-up generation
 */
async function generateWithAnthropic(userMessage: string): Promise<unknown> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: FOLLOW_UP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text;

  if (!content) {
    throw new Error('Empty response from Anthropic');
  }

  return JSON.parse(content);
}
