/**
 * Gmail Send Client
 *
 * Sends emails via the Gmail API.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 *
 * IMPORTANT: All sends go through approval gates.
 * This module only sends pre-approved emails.
 */

import { google } from 'googleapis';

/**
 * Email to send
 */
export interface EmailToSend {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string; // Gmail message ID to reply to
  threadId?: string;  // Gmail thread ID to continue
}

/**
 * Send result
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

/**
 * Get authenticated Gmail client for sending
 */
function getAuthenticatedGmail() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Build RFC 2822 formatted email message
 */
function buildEmailMessage(email: EmailToSend, fromEmail: string): string {
  const lines: string[] = [];

  // Headers
  lines.push(`From: ${fromEmail}`);
  lines.push(`To: ${email.to}`);
  lines.push(`Subject: ${email.subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=utf-8');

  // Reply headers if this is a reply
  if (email.inReplyTo) {
    lines.push(`In-Reply-To: ${email.inReplyTo}`);
    lines.push(`References: ${email.inReplyTo}`);
  }

  // Blank line separating headers from body
  lines.push('');

  // Body
  lines.push(email.body);

  return lines.join('\r\n');
}

/**
 * Send an email via Gmail API
 *
 * IMPORTANT: This function should only be called after user approval.
 * All sends are logged to the audit trail.
 */
export async function sendEmail(email: EmailToSend): Promise<SendResult> {
  try {
    const gmail = getAuthenticatedGmail();

    // Get sender email from profile
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;

    if (!fromEmail) {
      throw new Error('Could not determine sender email address');
    }

    console.log(`📧 Sending email from ${fromEmail} to ${email.to}`);
    console.log(`   Subject: ${email.subject}`);

    // Build the raw email message
    const rawMessage = buildEmailMessage(email, fromEmail);

    // Encode to base64url
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: email.threadId, // Continue existing thread if provided
      },
    });

    console.log(`✅ Email sent successfully. Message ID: ${response.data.id}`);

    return {
      success: true,
      messageId: response.data.id || undefined,
      threadId: response.data.threadId || undefined,
    };
  } catch (error) {
    console.error('❌ Failed to send email:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a reply to an existing thread
 *
 * Convenience wrapper that ensures proper threading
 */
export async function sendReply(
  to: string,
  subject: string,
  body: string,
  originalMessageId: string,
  threadId: string
): Promise<SendResult> {
  // Ensure subject starts with "Re: " if not already
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  return sendEmail({
    to,
    subject: replySubject,
    body,
    inReplyTo: originalMessageId,
    threadId,
  });
}

/**
 * Get the Gmail message ID format for In-Reply-To header
 *
 * Gmail stores messages with their own ID format, but the In-Reply-To
 * header needs the Message-ID header value from the original email.
 */
export async function getMessageIdHeader(gmailMessageId: string): Promise<string | null> {
  try {
    const gmail = getAuthenticatedGmail();

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: gmailMessageId,
      format: 'metadata',
      metadataHeaders: ['Message-ID'],
    });

    const messageIdHeader = message.data.payload?.headers?.find(
      (h) => h.name?.toLowerCase() === 'message-id'
    );

    return messageIdHeader?.value || null;
  } catch (error) {
    console.error('Failed to get Message-ID header:', error);
    return null;
  }
}
