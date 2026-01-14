/**
 * Follow-up Email Generation Prompt
 *
 * Used to generate contextual follow-up emails for stalled threads.
 * Part of Loop #2: Waiting-On + Follow-Up Engine
 */

export const FOLLOW_UP_SYSTEM_PROMPT = `You are an AI assistant helping to write professional follow-up emails.

Your task is to generate a follow-up email for a stalled conversation thread where the user sent the last message and hasn't received a reply.

CONTEXT:
- The user is a business owner/professional who needs to follow up on work conversations
- The follow-up should be polite, professional, and contextually relevant
- Never be passive-aggressive or rude
- Keep the email concise - busy people appreciate brevity

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "subject": "Re: [original subject] - Following up" or similar,
  "body": "The email body without greeting or signature (those will be added)",
  "tone": "professional" | "friendly" | "urgent",
  "reasoning": "Brief explanation of why you chose this approach"
}

TONE GUIDELINES:
- professional: Standard business follow-up, neutral and courteous
- friendly: Warmer tone for established relationships or informal contexts
- urgent: More direct for time-sensitive matters (use sparingly)

IMPORTANT RULES:
1. Be contextually aware - reference specific details from the thread
2. Acknowledge the recipient's busy schedule without being sycophantic
3. State clearly what you're following up on and what you need
4. Suggest a specific next step when appropriate
5. Keep the body under 100 words unless complexity requires more
6. Don't include greetings like "Hi [Name]" or signatures - those will be added
7. Don't make up facts or commitments not present in the thread
8. If the original request was unclear, politely ask for clarification rather than assuming`;

/**
 * Build the user message for follow-up generation
 */
export function buildFollowUpUserMessage(thread: {
  subject: string | null;
  waitingOnEmail: string | null;
  waitingSince: string | null;
  daysWaiting: number;
  emails: Array<{
    sender_email: string;
    body: string;
    received_at: string;
  }>;
}): string {
  // Build conversation history
  const conversationHistory = thread.emails
    .map((email, index) => {
      const date = new Date(email.received_at).toLocaleDateString();
      return `[${index + 1}] From: ${email.sender_email} (${date})
${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}`;
    })
    .join('\n\n---\n\n');

  return `Generate a follow-up email for this stalled thread:

THREAD SUBJECT: ${thread.subject || 'No subject'}
WAITING ON: ${thread.waitingOnEmail || 'Unknown recipient'}
DAYS WITHOUT REPLY: ${thread.daysWaiting}

CONVERSATION HISTORY (chronological):
${conversationHistory}

---

Please generate an appropriate follow-up email based on this context.`;
}

/**
 * Validate the AI response for follow-up generation
 */
export interface FollowUpGenerationResult {
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'urgent';
  reasoning: string;
}

export function validateFollowUpResult(response: unknown): FollowUpGenerationResult | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const result = response as Record<string, unknown>;

  // Required fields
  if (typeof result.subject !== 'string' || result.subject.trim().length === 0) {
    console.error('Invalid follow-up result: missing or invalid subject');
    return null;
  }

  if (typeof result.body !== 'string' || result.body.trim().length === 0) {
    console.error('Invalid follow-up result: missing or invalid body');
    return null;
  }

  // Validate tone
  const validTones = ['professional', 'friendly', 'urgent'];
  const tone = typeof result.tone === 'string' && validTones.includes(result.tone)
    ? (result.tone as 'professional' | 'friendly' | 'urgent')
    : 'professional';

  // Optional reasoning
  const reasoning = typeof result.reasoning === 'string' ? result.reasoning : '';

  return {
    subject: result.subject.trim(),
    body: result.body.trim(),
    tone,
    reasoning,
  };
}
