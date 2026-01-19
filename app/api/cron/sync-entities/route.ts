/**
 * Entity Sync Cron Job
 *
 * Processes emails, calendar events, and tasks to extract entities.
 * Runs periodically to build the entity graph from existing data.
 *
 * Part of Loop #6: Entity System + Chat Intelligence
 *
 * Usage: GET /api/cron/sync-entities
 *
 * Environment:
 * - Requires AI_PROVIDER (openai/anthropic) for entity extraction
 * - CRON_SECRET for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import {
  ENTITY_EXTRACTION_SYSTEM_PROMPT,
  buildEmailExtractionPrompt,
  buildEventExtractionPrompt,
  buildTaskExtractionPrompt,
  parseExtractionResponse,
} from '@/lib/entities/extractor';
import {
  upsertEntity,
  upsertRelationship,
  createEntityMention,
  markSourceProcessed,
  getUnprocessedSources,
  findEntityByName,
  Entity,
} from '@/lib/entities/queries';

export const dynamic = 'force-dynamic';

// Process a limited batch to stay within timeout
const BATCH_SIZE = 5;

/**
 * Call AI for entity extraction
 */
async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'openai';

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}

/**
 * Process an email for entity extraction
 */
async function processEmail(emailId: string): Promise<{ entities: number; relationships: number }> {
  // Fetch email with sender info
  const { data: email, error } = await supabase
    .from('emails')
    .select(`
      id,
      subject,
      body,
      sender_id,
      to_emails,
      cc_emails,
      people!emails_sender_id_fkey (email, name)
    `)
    .eq('id', emailId)
    .single();

  if (error || !email) {
    throw new Error(`Email not found: ${emailId}`);
  }

  // Cast to expected shape
  const emailData = email as {
    id: string;
    subject: string | null;
    body: string | null;
    sender_id: string;
    to_emails: string[] | null;
    cc_emails: string[] | null;
    people: { email: string; name: string | null } | null;
  };

  const sender = emailData.people;
  if (!sender) {
    console.log(`  ⚠️ No sender info for email ${emailId}`);
    return { entities: 0, relationships: 0 };
  }

  // Build extraction prompt
  const prompt = buildEmailExtractionPrompt({
    subject: emailData.subject || '',
    body: (emailData.body || '').substring(0, 5000), // Limit body size
    sender: { name: sender.name || '', email: sender.email },
    to_emails: emailData.to_emails || [],
    cc_emails: emailData.cc_emails || [],
  });

  // Call AI for extraction
  const aiResponse = await callAI(ENTITY_EXTRACTION_SYSTEM_PROMPT, prompt);
  const result = parseExtractionResponse(aiResponse);

  // Build entity map for relationship creation
  const entityMap = new Map<string, Entity>();

  // Process extracted entities
  for (const extractedEntity of result.entities) {
    const entity = await upsertEntity(extractedEntity);
    if (entity) {
      entityMap.set(extractedEntity.name, entity);
      await createEntityMention(entity.id, 'email', emailId, extractedEntity.context);
    }
  }

  // Process relationships
  let relationshipsCreated = 0;
  for (const rel of result.relationships) {
    const sourceEntity = entityMap.get(rel.sourceEntity) || await findEntityByName(rel.sourceEntity);
    const targetEntity = entityMap.get(rel.targetEntity) || await findEntityByName(rel.targetEntity);

    if (sourceEntity && targetEntity) {
      await upsertRelationship(sourceEntity.id, targetEntity.id, rel.type, rel.confidence);
      relationshipsCreated++;
    }
  }

  return { entities: result.entities.length, relationships: relationshipsCreated };
}

/**
 * Process a calendar event for entity extraction
 */
async function processCalendarEvent(eventId: string): Promise<{ entities: number; relationships: number }> {
  const { data: event, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !event) {
    throw new Error(`Calendar event not found: ${eventId}`);
  }

  // Cast to expected type
  const eventData = event as import('@/lib/supabase/calendar-queries').DBCalendarEvent;

  // Build extraction prompt
  const prompt = buildEventExtractionPrompt(eventData);

  // Call AI for extraction
  const aiResponse = await callAI(ENTITY_EXTRACTION_SYSTEM_PROMPT, prompt);
  const result = parseExtractionResponse(aiResponse);

  // Build entity map
  const entityMap = new Map<string, Entity>();

  // Process entities
  for (const extractedEntity of result.entities) {
    const entity = await upsertEntity(extractedEntity);
    if (entity) {
      entityMap.set(extractedEntity.name, entity);
      await createEntityMention(entity.id, 'calendar_event', eventId, extractedEntity.context);
    }
  }

  // Process relationships
  let relationshipsCreated = 0;
  for (const rel of result.relationships) {
    const sourceEntity = entityMap.get(rel.sourceEntity) || await findEntityByName(rel.sourceEntity);
    const targetEntity = entityMap.get(rel.targetEntity) || await findEntityByName(rel.targetEntity);

    if (sourceEntity && targetEntity) {
      await upsertRelationship(sourceEntity.id, targetEntity.id, rel.type, rel.confidence);
      relationshipsCreated++;
    }
  }

  return { entities: result.entities.length, relationships: relationshipsCreated };
}

/**
 * Process a task for entity extraction
 */
async function processTask(taskId: string): Promise<{ entities: number; relationships: number }> {
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      description,
      emails!tasks_email_id_fkey (subject)
    `)
    .eq('id', taskId)
    .single();

  if (error || !task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Cast to expected shape
  const taskData = task as {
    id: string;
    title: string;
    description: string | null;
    emails: { subject: string } | null;
  };

  // Build extraction prompt
  const prompt = buildTaskExtractionPrompt({
    title: taskData.title,
    description: taskData.description,
    email_subject: taskData.emails?.subject,
  });

  // Call AI for extraction
  const aiResponse = await callAI(ENTITY_EXTRACTION_SYSTEM_PROMPT, prompt);
  const result = parseExtractionResponse(aiResponse);

  // Build entity map
  const entityMap = new Map<string, Entity>();

  // Process entities
  for (const extractedEntity of result.entities) {
    const entity = await upsertEntity(extractedEntity);
    if (entity) {
      entityMap.set(extractedEntity.name, entity);
      await createEntityMention(entity.id, 'task', taskId, extractedEntity.context);
    }
  }

  // Process relationships
  let relationshipsCreated = 0;
  for (const rel of result.relationships) {
    const sourceEntity = entityMap.get(rel.sourceEntity) || await findEntityByName(rel.sourceEntity);
    const targetEntity = entityMap.get(rel.targetEntity) || await findEntityByName(rel.targetEntity);

    if (sourceEntity && targetEntity) {
      await upsertRelationship(sourceEntity.id, targetEntity.id, rel.type, rel.confidence);
      relationshipsCreated++;
    }
  }

  return { entities: result.entities.length, relationships: relationshipsCreated };
}

/**
 * Main entity sync handler
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting entity sync...');

    const results = {
      emails_processed: 0,
      events_processed: 0,
      tasks_processed: 0,
      entities_extracted: 0,
      relationships_created: 0,
      errors: [] as string[],
    };

    // 2. Get unprocessed sources
    const [unprocessedEmails, unprocessedEvents, unprocessedTasks] = await Promise.all([
      getUnprocessedSources('email', BATCH_SIZE),
      getUnprocessedSources('calendar_event', BATCH_SIZE),
      getUnprocessedSources('task', BATCH_SIZE),
    ]);

    console.log(`📧 Found ${unprocessedEmails.length} emails to process`);
    console.log(`📅 Found ${unprocessedEvents.length} events to process`);
    console.log(`✅ Found ${unprocessedTasks.length} tasks to process`);

    // 3. Process emails
    for (const emailId of unprocessedEmails) {
      try {
        console.log(`📧 Processing email ${emailId}...`);
        const { entities, relationships } = await processEmail(emailId);
        results.emails_processed++;
        results.entities_extracted += entities;
        results.relationships_created += relationships;
        await markSourceProcessed('email', emailId, entities, relationships);
        console.log(`  ✅ Extracted ${entities} entities, ${relationships} relationships`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed: ${msg}`);
        results.errors.push(`email ${emailId}: ${msg}`);
        await markSourceProcessed('email', emailId, 0, 0, msg);
      }
    }

    // 4. Process calendar events
    for (const eventId of unprocessedEvents) {
      try {
        console.log(`📅 Processing event ${eventId}...`);
        const { entities, relationships } = await processCalendarEvent(eventId);
        results.events_processed++;
        results.entities_extracted += entities;
        results.relationships_created += relationships;
        await markSourceProcessed('calendar_event', eventId, entities, relationships);
        console.log(`  ✅ Extracted ${entities} entities, ${relationships} relationships`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed: ${msg}`);
        results.errors.push(`event ${eventId}: ${msg}`);
        await markSourceProcessed('calendar_event', eventId, 0, 0, msg);
      }
    }

    // 5. Process tasks
    for (const taskId of unprocessedTasks) {
      try {
        console.log(`✅ Processing task ${taskId}...`);
        const { entities, relationships } = await processTask(taskId);
        results.tasks_processed++;
        results.entities_extracted += entities;
        results.relationships_created += relationships;
        await markSourceProcessed('task', taskId, entities, relationships);
        console.log(`  ✅ Extracted ${entities} entities, ${relationships} relationships`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`  ❌ Failed: ${msg}`);
        results.errors.push(`task ${taskId}: ${msg}`);
        await markSourceProcessed('task', taskId, 0, 0, msg);
      }
    }

    console.log('✅ Entity sync complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('❌ Fatal error in entity sync:', error);
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
 * POST endpoint for manual sync trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
