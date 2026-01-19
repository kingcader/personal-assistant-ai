/**
 * Entity Extraction Service
 *
 * AI-powered entity extraction from emails, calendar events, tasks.
 * Extracts people, organizations, projects, and their relationships.
 *
 * Part of Loop #6: Entity System + Chat Intelligence
 */

import type { DBCalendarEvent } from '@/lib/supabase/calendar-queries';

// ============================================
// TYPES
// ============================================

export type EntityType = 'person' | 'organization' | 'project' | 'deal';
export type RelationshipType = 'works_at' | 'owns' | 'client_of' | 'vendor_of' | 'involved_in' | 'related_to';

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  aliases: string[];
  email?: string;
  role?: string;
  description?: string;
  notes?: string; // User-provided context (e.g., "representing our project")
  confidence: number;
  context: string; // Where we found this entity
}

export interface ExtractedRelationship {
  sourceEntity: string; // Entity name
  targetEntity: string; // Entity name
  type: RelationshipType;
  confidence: number;
  context?: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

// ============================================
// SYSTEM PROMPTS
// ============================================

export const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You are an entity extraction AI for a personal assistant system. Your job is to identify entities (people, organizations, projects, deals) and their relationships from text.

## ENTITY TYPES

1. **person**: Individual people mentioned by name
   - Extract: Full name, nicknames/aliases, email if visible, role/title if mentioned
   - Examples: "Jennifer Smith", "Jen", "Sarah from Acme"

2. **organization**: Companies, teams, clients, vendors, government agencies
   - Extract: Company/org name, aliases, relationship to the user
   - Examples: "Acme Corp", "the Costa Rica team", "IRS"

3. **project**: Named projects, initiatives, campaigns
   - Extract: Project name, status if mentioned
   - Examples: "Q1 Marketing Campaign", "Website Redesign", "Phase 2"

4. **deal**: Business deals, contracts, agreements, transactions
   - Extract: Deal name/identifier, parties involved, status
   - Examples: "Costa Rica property deal", "Series A funding", "the Johnson contract"

## RELATIONSHIP TYPES

- **works_at**: Person → Organization (employment relationship)
- **owns**: Person → Organization (ownership relationship)
- **client_of**: Organization → User (they are a client)
- **vendor_of**: Organization → User (they are a vendor/supplier)
- **involved_in**: Person → Project/Deal (person is working on this)
- **related_to**: Generic relationship between any entities

## EXTRACTION GUIDELINES

1. **Be conservative**: Only extract entities you're confident about
2. **Use context**: If "Jen" is mentioned with "Acme", they're likely related
3. **Infer relationships**: "I met with Jen from Acme" → works_at relationship
4. **Extract emails**: If you see an email address, associate it with the person
5. **Handle aliases**: "Jennifer Smith (Jen)" → name: "Jennifer Smith", aliases: ["Jen"]
6. **Confidence levels**:
   - 1.0: Explicitly stated (e.g., "Jen Smith, CEO of Acme Corp")
   - 0.8: Strongly implied (e.g., "Jen from Acme")
   - 0.6: Inferred from context (e.g., same thread mentions both)
   - 0.4: Weak signal (e.g., mentioned in passing)

## RESPONSE FORMAT

Return a JSON object:
{
  "entities": [
    {
      "type": "person",
      "name": "Jennifer Smith",
      "aliases": ["Jen"],
      "email": "jen@acme.com",
      "role": "Partner",
      "notes": "representing our project",
      "confidence": 0.9,
      "context": "Email sender"
    },
    {
      "type": "organization",
      "name": "Acme Corp",
      "aliases": ["Acme"],
      "confidence": 0.8,
      "context": "Mentioned in signature"
    }
  ],
  "relationships": [
    {
      "sourceEntity": "Jennifer Smith",
      "targetEntity": "Acme Corp",
      "type": "works_at",
      "confidence": 0.9,
      "context": "Email signature: 'Jen Smith, Acme Corp'"
    }
  ]
}

NOTE: The "notes" field captures additional user-provided context that doesn't fit into role or description (e.g., "representing our project", "handles the Costa Rica deal").

## IMPORTANT RULES

- Return empty arrays if no entities found: {"entities": [], "relationships": []}
- Don't extract the user (Kincaid Garrett / kincaidgarrett@gmail.com) as an entity
- Don't extract generic terms like "team", "client", "vendor" without a specific name
- Prefer full names over first names when available
- Merge aliases (Jen → Jennifer Smith) rather than creating separate entities`;

/**
 * Build prompt for email entity extraction
 */
export function buildEmailExtractionPrompt(email: {
  subject: string;
  body: string;
  sender: { name: string; email: string };
  to_emails: string[];
  cc_emails?: string[];
}): string {
  return `Extract entities and relationships from this email:

## EMAIL METADATA
From: ${email.sender.name} <${email.sender.email}>
To: ${email.to_emails.join(', ')}
${email.cc_emails?.length ? `CC: ${email.cc_emails.join(', ')}` : ''}
Subject: ${email.subject}

## EMAIL BODY
${email.body}

## NOTES
- The sender (${email.sender.name}) should be extracted as a person entity if not the user
- Look for organization names in email domains, signatures, and mentions
- Identify any projects or deals discussed
- Detect relationships between people and organizations`;
}

/**
 * Build prompt for calendar event entity extraction
 */
export function buildEventExtractionPrompt(event: DBCalendarEvent): string {
  const attendeeList = event.attendees
    ?.map((a) => `${a.name || 'Unknown'} <${a.email}>`)
    .join('\n  - ') || 'None';

  return `Extract entities and relationships from this calendar event:

## EVENT METADATA
Title: ${event.summary || 'No title'}
Location: ${event.location || 'No location'}
Organizer: ${event.organizer ? `${event.organizer.name || 'Unknown'} <${event.organizer.email}>` : 'Unknown'}

## ATTENDEES
  - ${attendeeList}

## DESCRIPTION
${event.description || 'No description'}

## NOTES
- Each attendee should be extracted as a person entity
- Look for organization names in email domains
- The event title/description may reference projects or deals
- Detect relationships (who works where, who's involved in what)`;
}

/**
 * Build prompt for task entity extraction
 */
export function buildTaskExtractionPrompt(task: {
  title: string;
  description: string | null;
  email_subject?: string | null;
}): string {
  return `Extract entities and relationships from this task:

## TASK
Title: ${task.title}
${task.description ? `Description: ${task.description}` : ''}
${task.email_subject ? `Related Email: ${task.email_subject}` : ''}

## NOTES
- Look for person names in the task title (e.g., "Follow up with Jen")
- Identify organizations, projects, or deals mentioned
- Tasks often reference people by first name only`;
}

// ============================================
// RESPONSE PARSING
// ============================================

export function parseExtractionResponse(response: string): ExtractionResult {
  try {
    // Find JSON in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[EntityExtractor] No JSON found in response');
      return { entities: [], relationships: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize entities
    const entities: ExtractedEntity[] = (parsed.entities || [])
      .filter((e: any) => e && e.name && e.type)
      .map((e: any) => ({
        type: validateEntityType(e.type),
        name: String(e.name).trim(),
        aliases: Array.isArray(e.aliases) ? e.aliases.map((a: any) => String(a).trim()) : [],
        email: e.email ? String(e.email).toLowerCase().trim() : undefined,
        role: e.role ? String(e.role).trim() : undefined,
        description: e.description ? String(e.description).trim() : undefined,
        notes: e.notes ? String(e.notes).trim() : undefined,
        confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.5,
        context: e.context ? String(e.context).trim() : 'Extracted from text',
      }));

    // Validate and normalize relationships
    const relationships: ExtractedRelationship[] = (parsed.relationships || [])
      .filter((r: any) => r && r.sourceEntity && r.targetEntity && r.type)
      .map((r: any) => ({
        sourceEntity: String(r.sourceEntity).trim(),
        targetEntity: String(r.targetEntity).trim(),
        type: validateRelationshipType(r.type),
        confidence: typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0.5,
        context: r.context ? String(r.context).trim() : undefined,
      }));

    return { entities, relationships };
  } catch (error) {
    console.error('[EntityExtractor] Failed to parse extraction response:', error);
    return { entities: [], relationships: [] };
  }
}

function validateEntityType(type: string): EntityType {
  const valid: EntityType[] = ['person', 'organization', 'project', 'deal'];
  const normalized = String(type).toLowerCase().trim() as EntityType;
  return valid.includes(normalized) ? normalized : 'person';
}

function validateRelationshipType(type: string): RelationshipType {
  const valid: RelationshipType[] = ['works_at', 'owns', 'client_of', 'vendor_of', 'involved_in', 'related_to'];
  const normalized = String(type).toLowerCase().trim() as RelationshipType;
  return valid.includes(normalized) ? normalized : 'related_to';
}

// ============================================
// ENTITY NAME DETECTION (for chat)
// ============================================

/**
 * Simple pattern-based entity name extraction from chat messages
 * This is a lightweight alternative to full AI extraction for quick entity lookups
 */
export function extractEntityNamesFromMessage(message: string): string[] {
  const names: string[] = [];

  // Pattern 1: "about [Name]" or "with [Name]"
  const aboutPattern = /(?:about|with|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  let match;
  while ((match = aboutPattern.exec(message)) !== null) {
    names.push(match[1]);
  }

  // Pattern 2: Capitalized names (2+ letters, not at start of sentence after period)
  const capitalizedPattern = /(?:^|\s)([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?)/g;
  while ((match = capitalizedPattern.exec(message)) !== null) {
    const name = match[1].trim();
    // Filter out common words that might be capitalized
    const commonWords = ['The', 'What', 'When', 'Where', 'Why', 'How', 'Can', 'Could', 'Would', 'Should',
                         'Will', 'Tell', 'Show', 'Find', 'Get', 'Give', 'Today', 'Tomorrow', 'Monday',
                         'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!commonWords.includes(name) && !names.includes(name)) {
      names.push(name);
    }
  }

  return [...new Set(names)]; // Deduplicate
}
