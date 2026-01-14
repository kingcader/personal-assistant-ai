/**
 * Follow-up Send API
 *
 * Sends an approved follow-up email via Gmail.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * IMPORTANT: Only sends emails that have been explicitly approved.
 *
 * Usage: POST /api/follow-ups/:id/send
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFollowUpById,
  markFollowUpSent,
  getThreadWithEmails,
  resolveThread,
} from '@/lib/supabase/thread-queries';
import { sendEmail, getMessageIdHeader } from '@/lib/gmail/send';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Send an approved follow-up email
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: followUpId } = await params;

    if (!followUpId) {
      return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 });
    }

    console.log(`📧 Attempting to send follow-up: ${followUpId}`);

    // 1. Get follow-up suggestion
    const followUp = await getFollowUpById(followUpId);

    if (!followUp) {
      return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    }

    // 2. Verify it's approved (not pending, rejected, or already sent)
    if (followUp.status !== 'approved') {
      return NextResponse.json(
        {
          error: `Cannot send follow-up with status "${followUp.status}". Must be "approved".`,
        },
        { status: 400 }
      );
    }

    // 3. Get thread for context
    const thread = await getThreadWithEmails(followUp.thread_id);

    if (!thread) {
      return NextResponse.json({ error: 'Associated thread not found' }, { status: 404 });
    }

    if (!thread.waiting_on_email) {
      return NextResponse.json(
        { error: 'Thread has no recipient (waiting_on_email is null)' },
        { status: 400 }
      );
    }

    // 4. Determine final subject and body (use user edits if available)
    const finalSubject = followUp.user_edited_subject || followUp.draft_subject || `Re: ${thread.subject || 'Follow-up'}`;
    const finalBody = followUp.user_edited_body || followUp.draft_body;

    // 5. Get threading information from the last email in the thread
    const lastEmail = thread.emails[thread.emails.length - 1];
    let inReplyTo: string | undefined;

    if (lastEmail) {
      // Try to get the Message-ID header for proper threading
      // This requires the gmail_message_id which we might not have directly
      // For now, we'll skip In-Reply-To if we can't get it
      // The threadId alone should be enough for Gmail to thread properly
    }

    // 6. Send the email
    console.log(`📤 Sending to: ${thread.waiting_on_email}`);
    console.log(`   Subject: ${finalSubject}`);

    const sendResult = await sendEmail({
      to: thread.waiting_on_email,
      subject: finalSubject,
      body: finalBody,
      threadId: thread.gmail_thread_id,
      inReplyTo,
    });

    if (!sendResult.success) {
      console.error('❌ Failed to send email:', sendResult.error);
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || 'Failed to send email',
        },
        { status: 500 }
      );
    }

    // 7. Mark follow-up as sent
    await markFollowUpSent(followUpId, sendResult.messageId || '');

    // 8. Optionally resolve the thread (since we just sent a follow-up)
    // The thread will be re-evaluated on next sync if no reply comes
    await resolveThread(thread.id, 'follow_up_sent');

    console.log(`✅ Follow-up sent successfully. Gmail Message ID: ${sendResult.messageId}`);

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      threadId: sendResult.threadId,
    });
  } catch (error) {
    console.error('❌ Error sending follow-up:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
