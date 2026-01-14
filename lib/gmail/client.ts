/**
 * Gmail API Client
 *
 * Fetches emails from Gmail using the Gmail API.
 * Uses OAuth 2.0 credentials stored in environment variables.
 */

import { google } from 'googleapis';

const gmail = google.gmail('v1');

/**
 * Get authenticated Gmail client
 */
export function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return gmail;
}

/**
 * Email data structure from Gmail
 */
export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  body: string;
  receivedAt: Date;
  hasAttachments: boolean;
}

/**
 * Fetch emails with specific label
 */
export async function fetchEmailsWithLabel(
  labelName: string = 'AI/Work',
  maxResults: number = 10
): Promise<GmailEmail[]> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Get label ID from name
  const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
  const label = labelsResponse.data.labels?.find((l) => l.name === labelName);

  if (!label?.id) {
    throw new Error(`Label "${labelName}" not found in Gmail`);
  }

  // Fetch messages with this label
  const messagesResponse = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [label.id],
    maxResults,
  });

  const messages = messagesResponse.data.messages || [];

  // Fetch full message details for each
  const emails: GmailEmail[] = [];

  for (const message of messages) {
    if (!message.id) continue;

    const fullMessage = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'full',
    });

    const headers = fullMessage.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract body
    let body = '';
    if (fullMessage.data.payload?.parts) {
      // Multipart message
      const textPart = fullMessage.data.payload.parts.find(
        (part) => part.mimeType === 'text/plain'
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (fullMessage.data.payload?.body?.data) {
      // Simple message
      body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
    }

    // Parse recipients
    const toHeader = getHeader('To');
    const ccHeader = getHeader('Cc');

    emails.push({
      id: message.id,
      threadId: fullMessage.data.threadId || '',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: toHeader ? toHeader.split(',').map((e) => e.trim()) : [],
      cc: ccHeader ? ccHeader.split(',').map((e) => e.trim()) : [],
      body,
      receivedAt: new Date(parseInt(fullMessage.data.internalDate || '0')),
      hasAttachments: (fullMessage.data.payload?.parts?.length || 0) > 1,
    });
  }

  return emails;
}

/**
 * Parse email address from "Name <email@domain.com>" format
 */
export function parseEmailAddress(emailString: string): {
  email: string;
  name: string | null;
} {
  const match = emailString.match(/<(.+?)>/);
  if (match) {
    return {
      email: match[1],
      name: emailString.replace(/<.+?>/, '').trim() || null,
    };
  }
  return {
    email: emailString.trim(),
    name: null,
  };
}

/**
 * Fetch all messages in specific threads (including sent emails)
 * This is used to get the full conversation for waiting-on detection
 */
export async function fetchMessagesInThreads(
  threadIds: string[]
): Promise<GmailEmail[]> {
  if (threadIds.length === 0) return [];

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const emails: GmailEmail[] = [];
  const processedMessageIds = new Set<string>();

  // Fetch each thread and get all messages in it
  for (const threadId of threadIds) {
    try {
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const messages = threadResponse.data.messages || [];

      for (const message of messages) {
        if (!message.id || processedMessageIds.has(message.id)) continue;
        processedMessageIds.add(message.id);

        const headers = message.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract body
        let body = '';
        if (message.payload?.parts) {
          // Multipart message - look for text/plain
          const textPart = findTextPart(message.payload.parts);
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        } else if (message.payload?.body?.data) {
          // Simple message
          body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        }

        // Parse recipients
        const toHeader = getHeader('To');
        const ccHeader = getHeader('Cc');

        emails.push({
          id: message.id,
          threadId: message.threadId || threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: toHeader ? toHeader.split(',').map((e) => e.trim()) : [],
          cc: ccHeader ? ccHeader.split(',').map((e) => e.trim()) : [],
          body,
          receivedAt: new Date(parseInt(message.internalDate || '0')),
          hasAttachments: (message.payload?.parts?.length || 0) > 1,
        });
      }
    } catch (error) {
      console.error(`Error fetching thread ${threadId}:`, error);
      // Continue with other threads
    }
  }

  return emails;
}

/**
 * Recursively find text/plain part in multipart message
 */
function findTextPart(parts: any[]): any {
  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      return part;
    }
    if (part.parts) {
      const found = findTextPart(part.parts);
      if (found) return found;
    }
  }
  return null;
}
