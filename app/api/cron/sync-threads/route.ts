/**
 * Thread Sync Cron Job
 *
 * Aggregates emails into threads and detects "waiting on" status.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * What this does:
 * 1. Groups emails by Gmail thread_id
 * 2. Creates/updates thread records
 * 3. Determines who sent the last message
 * 4. Detects waiting-on status (I sent last + no reply for 2+ days)
 * 5. Links emails to their internal thread record
 * 6. Reactivates expired snoozed threads
 *
 * Trigger: Run after process-emails or on its own schedule
 * Usage: GET /api/cron/sync-threads
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailsGroupedByThread,
  getUniqueThreadIds,
  upsertThread,
  updateWaitingOnStatus,
  linkEmailToThread,
  getSnoozedThreadsToReactivate,
  reactivateThread,
  MY_EMAIL,
  WAITING_THRESHOLD_DAYS,
} from '@/lib/supabase/thread-queries';
import { upsertEmail } from '@/lib/supabase/task-queries';
import { fetchMessagesInThreads, parseEmailAddress } from '@/lib/gmail/client';
import { notify } from '@/lib/notifications/push';
import type { ThreadParticipant } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * Main thread sync handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate (optional: check for a secret token)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting thread sync...');

    const results = {
      threads_created: 0,
      threads_updated: 0,
      waiting_on_detected: 0,
      emails_linked: 0,
      sent_emails_added: 0,
      snoozed_reactivated: 0,
      errors: [] as string[],
    };

    // 2. First, fetch sent emails for all Work threads
    // This ensures we have complete thread data for waiting-on detection
    try {
      const threadIds = await getUniqueThreadIds();
      console.log(`📨 Fetching complete thread data for ${threadIds.length} threads...`);

      if (threadIds.length > 0) {
        // Fetch all messages in these threads (including sent)
        const allMessages = await fetchMessagesInThreads(threadIds);
        console.log(`📬 Found ${allMessages.length} total messages in threads`);

        // Store any new messages (idempotent via gmail_message_id)
        for (const msg of allMessages) {
          try {
            const { isNew } = await upsertEmail({
              gmail_message_id: msg.id,
              thread_id: msg.threadId,
              sender_email: parseEmailAddress(msg.from).email,
              sender_name: parseEmailAddress(msg.from).name,
              subject: msg.subject,
              body: msg.body,
              received_at: msg.receivedAt.toISOString(),
              to_emails: msg.to.map((e) => parseEmailAddress(e).email),
              cc_emails: msg.cc.map((e) => parseEmailAddress(e).email),
              has_attachments: msg.hasAttachments,
            });

            if (isNew) {
              results.sent_emails_added++;
              console.log(`📤 Added sent email: ${msg.subject}`);
            }
          } catch (err) {
            // Continue on error - might be duplicate or constraint issue
            console.error(`Error storing message ${msg.id}:`, err);
          }
        }

        if (results.sent_emails_added > 0) {
          console.log(`✅ Added ${results.sent_emails_added} sent emails to database`);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching sent emails:', error);
      results.errors.push(`Sent email fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Get all emails grouped by thread_id (now includes sent emails)
    const emailsByThread = await getEmailsGroupedByThread();
    console.log(`📧 Found ${emailsByThread.size} unique threads to process`);

    // 3. Process each thread
    for (const [gmailThreadId, emails] of emailsByThread) {
      try {
        // Sort emails by received_at
        const sortedEmails = emails.sort(
          (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        );

        const firstEmail = sortedEmails[0];
        const lastEmail = sortedEmails[sortedEmails.length - 1];

        // Build participants list
        const participantsMap = new Map<string, ThreadParticipant>();

        for (const email of sortedEmails) {
          // Add sender
          if (email.sender_email) {
            participantsMap.set(email.sender_email.toLowerCase(), {
              email: email.sender_email.toLowerCase(),
              role: 'sender',
            });
          }

          // Add recipients
          for (const to of email.to_emails || []) {
            const toEmail = to.toLowerCase();
            if (!participantsMap.has(toEmail)) {
              participantsMap.set(toEmail, { email: toEmail, role: 'recipient' });
            }
          }

          // Add CC
          for (const cc of email.cc_emails || []) {
            const ccEmail = cc.toLowerCase();
            if (!participantsMap.has(ccEmail)) {
              participantsMap.set(ccEmail, { email: ccEmail, role: 'cc' });
            }
          }
        }

        const participants = Array.from(participantsMap.values());

        // Find when I last sent a message in this thread
        const myEmails = sortedEmails.filter(
          (e) => e.sender_email.toLowerCase() === MY_EMAIL.toLowerCase()
        );
        const myLastEmail = myEmails[myEmails.length - 1];
        const myLastMessageAt = myLastEmail?.received_at || null;

        // 4. Create/update thread record
        const { thread, isNew } = await upsertThread({
          gmail_thread_id: gmailThreadId,
          subject: firstEmail.subject,
          participants,
          first_message_at: firstEmail.received_at,
          last_message_at: lastEmail.received_at,
          last_sender_email: lastEmail.sender_email.toLowerCase(),
          my_last_message_at: myLastMessageAt,
          message_count: sortedEmails.length,
        });

        if (isNew) {
          results.threads_created++;
        } else {
          results.threads_updated++;
        }

        // 5. Detect waiting-on status
        // Logic: I sent the last message AND it's been > WAITING_THRESHOLD_DAYS
        const iSentLast =
          myLastMessageAt &&
          lastEmail.sender_email.toLowerCase() === MY_EMAIL.toLowerCase();

        if (iSentLast) {
          const daysSinceMyMessage =
            (Date.now() - new Date(myLastMessageAt!).getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceMyMessage >= WAITING_THRESHOLD_DAYS && thread.status === 'active') {
            // Find who I'm waiting on (recipients of my last message, excluding myself)
            const myLastEmailData = myEmails[myEmails.length - 1];
            const recipients = (myLastEmailData?.to_emails || [])
              .filter((e) => e.toLowerCase() !== MY_EMAIL.toLowerCase());

            // Use the first recipient as the "waiting on" person
            const waitingOnEmail = recipients[0]?.toLowerCase() || null;

            if (waitingOnEmail) {
              await updateWaitingOnStatus(thread.id, waitingOnEmail, myLastMessageAt!);
              results.waiting_on_detected++;
              console.log(
                `⏳ Waiting on ${waitingOnEmail} in thread: ${firstEmail.subject} (${daysSinceMyMessage.toFixed(1)} days)`
              );

              // Send push notification for waiting-on detection
              try {
                await notify({
                  type: 'waiting_on',
                  title: 'Waiting for Reply',
                  body: `${waitingOnEmail} hasn't replied to "${firstEmail.subject}" (${Math.floor(daysSinceMyMessage)} days)`,
                  link: '/waiting-on',
                  tag: `waiting-on-${thread.id}`,
                  related_entity_type: 'thread',
                  related_entity_id: thread.id,
                });
              } catch (notifyError) {
                console.error('Failed to send waiting-on notification:', notifyError);
              }
            }
          }
        } else if (thread.waiting_on_email) {
          // Someone replied - clear waiting-on status
          await updateWaitingOnStatus(thread.id, null, null);
          console.log(`✅ Reply received in thread: ${firstEmail.subject}`);
        }

        // 6. Link emails to internal thread
        for (const email of sortedEmails) {
          await linkEmailToThread(email.id, thread.id);
          results.emails_linked++;
        }
      } catch (error) {
        console.error(`❌ Error processing thread ${gmailThreadId}:`, error);
        results.errors.push(
          `Thread ${gmailThreadId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // 7. Reactivate expired snoozed threads
    try {
      const snoozedThreads = await getSnoozedThreadsToReactivate();
      for (const thread of snoozedThreads) {
        await reactivateThread(thread.id);
        results.snoozed_reactivated++;
        console.log(`🔔 Reactivated snoozed thread: ${thread.subject}`);
      }
    } catch (error) {
      console.error('❌ Error reactivating snoozed threads:', error);
      results.errors.push(
        `Snooze reactivation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    console.log('✅ Thread sync complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Fatal error in thread sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
