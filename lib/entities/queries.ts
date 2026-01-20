/**
 * Entity Database Queries
 *
 * CRUD operations for entities, relationships, and mentions.
 * Supports entity lookup, upsert, and relationship management.
 *
 * Part of Loop #6: Entity System + Chat Intelligence
 */

import { supabase } from '@/lib/supabase/client';
import type { ExtractedEntity, ExtractedRelationship, EntityType, RelationshipType } from './extractor';

// Helper to bypass Supabase type checking for new tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// TYPES
// ============================================

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  email: string | null;
  description: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  first_seen_at: string | null;
  last_seen_at: string | null;
  mention_count: number;
  is_important: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: RelationshipType;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EntityMention {
  id: string;
  entity_id: string;
  source_type: 'email' | 'task' | 'calendar_event' | 'kb_document';
  source_id: string;
  context: string | null;
  confidence: number;
  created_at: string;
}

export interface EntityWithRelationships extends Entity {
  relationships: Array<{
    entity: Entity;
    type: RelationshipType;
    direction: 'outgoing' | 'incoming';
  }>;
}

// ============================================
// ENTITY CRUD
// ============================================

/**
 * Find entity by name or alias (case-insensitive)
 * Uses a scoring system to find the best match
 */
export async function findEntityByName(name: string): Promise<Entity | null> {
  const normalizedQuery = name.toLowerCase().trim();

  // First try exact name match (case-insensitive)
  const { data: exactMatch, error: exactError } = await db
    .from('entities')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .single();

  if (!exactError && exactMatch) {
    return exactMatch as Entity;
  }

  // Try exact alias match
  const { data: aliasMatches, error: aliasError } = await db
    .from('entities')
    .select('*')
    .contains('aliases', [name]);

  if (!aliasError && aliasMatches && aliasMatches.length > 0) {
    // If multiple alias matches, prefer exact alias match
    const exactAliasMatch = aliasMatches.find((e: Entity) =>
      e.aliases.some((a: string) => a.toLowerCase() === normalizedQuery)
    );
    if (exactAliasMatch) {
      return exactAliasMatch as Entity;
    }
    return aliasMatches[0] as Entity;
  }

  // Try partial name matches - get candidates and score them
  const { data: partialMatches, error: partialError } = await db
    .from('entities')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(20); // Get more candidates to score

  if (!partialError && partialMatches && partialMatches.length > 0) {
    // Score each match - higher score = better match
    const scored: Array<{ entity: Entity; score: number }> = partialMatches.map((entity: Entity) => {
      const entityName = entity.name.toLowerCase();
      let score = 0;

      // Exact match (shouldn't happen here, but just in case)
      if (entityName === normalizedQuery) {
        score = 1000;
      }
      // Name starts with query (e.g., "Black Coast" matches "Black Coast Estates")
      else if (entityName.startsWith(normalizedQuery)) {
        score = 500 + (normalizedQuery.length / entityName.length) * 100;
      }
      // Query is a significant word match (e.g., "Estates" matches "Black Coast Estates")
      else if (entityName.includes(normalizedQuery)) {
        // Prefer when query is a larger portion of the name
        score = 100 + (normalizedQuery.length / entityName.length) * 100;
      }

      // Bonus for higher mention count (but less important than match quality)
      score += Math.min(entity.mention_count, 50) * 0.5;

      return { entity, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Only return if we have a reasonable match
    if (scored[0].score > 0) {
      return scored[0].entity as Entity;
    }
  }

  return null;
}

/**
 * Find entity by email
 */
export async function findEntityByEmail(email: string): Promise<Entity | null> {
  const { data, error } = await db
    .from('entities')
    .select('*')
    .ilike('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[EntityQueries] Error finding entity by email:', error);
    return null;
  }

  return data as Entity | null;
}

/**
 * Create or update an entity
 * If entity with same name/email exists, update it; otherwise create new
 */
export async function upsertEntity(extracted: ExtractedEntity): Promise<Entity | null> {
  // First, try to find existing entity by email (most reliable) or name
  let existingEntity: Entity | null = null;

  if (extracted.email) {
    existingEntity = await findEntityByEmail(extracted.email);
  }

  if (!existingEntity) {
    existingEntity = await findEntityByName(extracted.name);
  }

  if (existingEntity) {
    // Update existing entity
    const updatedAliases = [...new Set([
      ...existingEntity.aliases,
      ...extracted.aliases,
      // Add the extracted name as an alias if different from existing name
      ...(extracted.name.toLowerCase() !== existingEntity.name.toLowerCase() ? [extracted.name] : []),
    ])].filter((a) => a.toLowerCase() !== existingEntity!.name.toLowerCase());

    const metadata = {
      ...existingEntity.metadata,
      ...(extracted.role ? { role: extracted.role } : {}),
    };

    // Merge notes if both exist
    let mergedNotes = existingEntity.notes;
    if (extracted.notes) {
      if (existingEntity.notes && !existingEntity.notes.includes(extracted.notes)) {
        mergedNotes = `${existingEntity.notes}\n${extracted.notes}`;
      } else {
        mergedNotes = extracted.notes;
      }
    }

    const updatePayload = {
      aliases: updatedAliases,
      email: extracted.email || existingEntity.email,
      description: extracted.description || existingEntity.description,
      notes: mergedNotes,
      metadata,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from('entities')
      .update(updatePayload)
      .eq('id', existingEntity.id)
      .select()
      .single();

    if (error) {
      console.error('[EntityQueries] Error updating entity:', error);
      return existingEntity; // Return existing even if update failed
    }

    return data as Entity;
  } else {
    // Create new entity
    const insertPayload = {
      type: extracted.type,
      name: extracted.name,
      aliases: extracted.aliases,
      email: extracted.email || null,
      description: extracted.description || null,
      notes: extracted.notes || null,
      metadata: extracted.role ? { role: extracted.role } : {},
      first_seen_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from('entities')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[EntityQueries] Error creating entity:', error);
      return null;
    }

    return data as Entity;
  }
}

/**
 * Get entity by ID
 */
export async function getEntityById(id: string): Promise<Entity | null> {
  const { data, error } = await db
    .from('entities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[EntityQueries] Error getting entity:', error);
    return null;
  }

  return data as Entity;
}

/**
 * Get all entities of a specific type
 */
export async function getEntitiesByType(
  type: EntityType,
  limit: number = 50
): Promise<Entity[]> {
  const { data, error } = await db
    .from('entities')
    .select('*')
    .eq('type', type)
    .order('mention_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[EntityQueries] Error getting entities by type:', error);
    return [];
  }

  return data as Entity[];
}

/**
 * Get important entities
 */
export async function getImportantEntities(): Promise<Entity[]> {
  const { data, error } = await db
    .from('entities')
    .select('*')
    .eq('is_important', true)
    .order('last_seen_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[EntityQueries] Error getting important entities:', error);
    return [];
  }

  return data as Entity[];
}

/**
 * Mark entity as important
 */
export async function markEntityImportant(id: string, important: boolean): Promise<void> {
  const { error } = await db
    .from('entities')
    .update({ is_important: important, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[EntityQueries] Error marking entity important:', error);
  }
}

/**
 * Rename an entity
 * Moves the old name to aliases and sets the new name
 */
export async function renameEntity(
  entityId: string,
  newName: string
): Promise<Entity | null> {
  // Get existing entity
  const existing = await getEntityById(entityId);
  if (!existing) {
    console.error('[EntityQueries] Entity not found for rename:', entityId);
    return null;
  }

  // Don't rename if already the same name
  if (existing.name.toLowerCase() === newName.toLowerCase()) {
    return existing;
  }

  // Add old name to aliases (if not already there)
  const updatedAliases = [...new Set([
    ...existing.aliases,
    existing.name, // Add old name as alias
  ])].filter(a => a.toLowerCase() !== newName.toLowerCase()); // Remove new name from aliases if present

  const { data, error } = await db
    .from('entities')
    .update({
      name: newName,
      aliases: updatedAliases,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId)
    .select()
    .single();

  if (error) {
    console.error('[EntityQueries] Error renaming entity:', error);
    return existing;
  }

  console.log(`[EntityQueries] Renamed entity from "${existing.name}" to "${newName}"`);
  return data as Entity;
}

// ============================================
// RELATIONSHIPS
// ============================================

/**
 * Create or update a relationship between entities
 */
export async function upsertRelationship(
  sourceEntityId: string,
  targetEntityId: string,
  type: RelationshipType,
  confidence: number = 1.0,
  metadata: Record<string, any> = {}
): Promise<EntityRelationship | null> {
  const { data, error } = await db
    .from('entity_relationships')
    .upsert({
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      relationship_type: type,
      confidence,
      metadata,
    }, {
      onConflict: 'source_entity_id,target_entity_id,relationship_type',
    })
    .select()
    .single();

  if (error) {
    console.error('[EntityQueries] Error upserting relationship:', error);
    return null;
  }

  return data as EntityRelationship;
}

/**
 * Create relationship from extracted data
 * Finds or creates entities first, then creates the relationship
 */
export async function createRelationshipFromExtracted(
  relationship: ExtractedRelationship,
  entityMap: Map<string, Entity>
): Promise<EntityRelationship | null> {
  const sourceEntity = entityMap.get(relationship.sourceEntity);
  const targetEntity = entityMap.get(relationship.targetEntity);

  if (!sourceEntity || !targetEntity) {
    console.warn('[EntityQueries] Missing entity for relationship:', relationship);
    return null;
  }

  return upsertRelationship(
    sourceEntity.id,
    targetEntity.id,
    relationship.type,
    relationship.confidence,
    relationship.context ? { context: relationship.context } : {}
  );
}

/**
 * Get all relationships for an entity (both directions)
 */
export async function getEntityRelationships(entityId: string): Promise<Array<{
  entity: Entity;
  type: RelationshipType;
  direction: 'outgoing' | 'incoming';
  confidence: number;
}>> {
  // Get outgoing relationships
  const { data: outgoing, error: outErr } = await db
    .from('entity_relationships')
    .select('*, target:entities!entity_relationships_target_entity_id_fkey(*)')
    .eq('source_entity_id', entityId);

  if (outErr) {
    console.error('[EntityQueries] Error getting outgoing relationships:', outErr);
  }

  // Get incoming relationships
  const { data: incoming, error: inErr } = await db
    .from('entity_relationships')
    .select('*, source:entities!entity_relationships_source_entity_id_fkey(*)')
    .eq('target_entity_id', entityId);

  if (inErr) {
    console.error('[EntityQueries] Error getting incoming relationships:', inErr);
  }

  const results: Array<{
    entity: Entity;
    type: RelationshipType;
    direction: 'outgoing' | 'incoming';
    confidence: number;
  }> = [];

  // Process outgoing
  for (const rel of outgoing || []) {
    if (rel.target) {
      results.push({
        entity: rel.target as Entity,
        type: rel.relationship_type as RelationshipType,
        direction: 'outgoing',
        confidence: rel.confidence,
      });
    }
  }

  // Process incoming
  for (const rel of incoming || []) {
    if (rel.source) {
      results.push({
        entity: rel.source as Entity,
        type: rel.relationship_type as RelationshipType,
        direction: 'incoming',
        confidence: rel.confidence,
      });
    }
  }

  return results;
}

// ============================================
// MENTIONS
// ============================================

/**
 * Create an entity mention
 */
export async function createEntityMention(
  entityId: string,
  sourceType: 'email' | 'task' | 'calendar_event' | 'kb_document',
  sourceId: string,
  context?: string,
  confidence: number = 1.0
): Promise<EntityMention | null> {
  const { data, error } = await db
    .from('entity_mentions')
    .upsert({
      entity_id: entityId,
      source_type: sourceType,
      source_id: sourceId,
      context,
      confidence,
    }, {
      onConflict: 'entity_id,source_type,source_id',
    })
    .select()
    .single();

  if (error) {
    console.error('[EntityQueries] Error creating entity mention:', error);
    return null;
  }

  return data as EntityMention;
}

/**
 * Get mentions for an entity
 */
export async function getEntityMentions(
  entityId: string,
  limit: number = 20
): Promise<EntityMention[]> {
  const { data, error } = await db
    .from('entity_mentions')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[EntityQueries] Error getting entity mentions:', error);
    return [];
  }

  return data as EntityMention[];
}

/**
 * Get entities mentioned in a source record
 */
export async function getEntitiesForSource(
  sourceType: 'email' | 'task' | 'calendar_event' | 'kb_document',
  sourceId: string
): Promise<Entity[]> {
  const { data, error } = await db
    .from('entity_mentions')
    .select('entity_id, entities(*)')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId);

  if (error) {
    console.error('[EntityQueries] Error getting entities for source:', error);
    return [];
  }

  return data
    ?.map((m: any) => m.entities)
    .filter((e: Entity | null) => e !== null) as Entity[];
}

// ============================================
// PROCESSING LOG
// ============================================

/**
 * Check if a source has been processed for entities
 */
export async function isSourceProcessed(
  sourceType: string,
  sourceId: string
): Promise<boolean> {
  const { data, error } = await db
    .from('entity_processing_log')
    .select('id')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[EntityQueries] Error checking processing status:', error);
  }

  return !!data;
}

/**
 * Mark a source as processed for entities
 */
export async function markSourceProcessed(
  sourceType: string,
  sourceId: string,
  entitiesFound: number,
  relationshipsFound: number,
  error?: string
): Promise<void> {
  const { error: insertError } = await db
    .from('entity_processing_log')
    .upsert({
      source_type: sourceType,
      source_id: sourceId,
      processed_at: new Date().toISOString(),
      entities_found: entitiesFound,
      relationships_found: relationshipsFound,
      error: error || null,
    }, {
      onConflict: 'source_type,source_id',
    });

  if (insertError) {
    console.error('[EntityQueries] Error marking source processed:', insertError);
  }
}

/**
 * Get unprocessed sources of a specific type
 */
export async function getUnprocessedSources(
  sourceType: 'email' | 'task' | 'calendar_event' | 'kb_document',
  limit: number = 50
): Promise<string[]> {
  // This requires a different approach depending on source type
  // We need to left join with processing log and find nulls
  const tableName = sourceType === 'email' ? 'emails'
    : sourceType === 'task' ? 'tasks'
    : sourceType === 'calendar_event' ? 'calendar_events'
    : 'kb_documents';

  // Get recent records of this type
  const { data: sources, error } = await supabase
    .from(tableName)
    .select('id')
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Get extra to account for already processed

  if (error) {
    console.error('[EntityQueries] Error getting sources:', error);
    return [];
  }

  const sourceIds = sources?.map((s: any) => s.id) || [];

  // Check which are already processed
  const { data: processed, error: procError } = await db
    .from('entity_processing_log')
    .select('source_id')
    .eq('source_type', sourceType)
    .in('source_id', sourceIds);

  if (procError) {
    console.error('[EntityQueries] Error checking processed:', procError);
    return sourceIds.slice(0, limit);
  }

  const processedIds = new Set(processed?.map((p: any) => p.source_id) || []);
  return sourceIds.filter((id: string) => !processedIds.has(id)).slice(0, limit);
}

// ============================================
// ENTITY CONTEXT (for chat)
// ============================================

/**
 * Get comprehensive context for an entity
 * Used by chat to provide entity-aware responses
 */
export async function getEntityContext(entityId: string): Promise<{
  entity: Entity;
  relationships: Array<{ entity: Entity; type: RelationshipType; direction: 'outgoing' | 'incoming' }>;
  recentMentions: EntityMention[];
} | null> {
  const entity = await getEntityById(entityId);
  if (!entity) return null;

  const [relationships, recentMentions] = await Promise.all([
    getEntityRelationships(entityId),
    getEntityMentions(entityId, 10),
  ]);

  return {
    entity,
    relationships,
    recentMentions,
  };
}

/**
 * Search entities by partial name match
 */
export async function searchEntities(
  query: string,
  limit: number = 10
): Promise<Entity[]> {
  const { data, error } = await db
    .from('entities')
    .select('*')
    .or(`name.ilike.%${query}%,aliases.cs.{${query}}`)
    .order('mention_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[EntityQueries] Error searching entities:', error);
    return [];
  }

  return data as Entity[];
}

/**
 * Get recently seen entities
 */
export async function getRecentEntities(limit: number = 10): Promise<Entity[]> {
  const { data, error } = await db
    .from('entities')
    .select('*')
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('[EntityQueries] Error getting recent entities:', error);
    return [];
  }

  return data as Entity[];
}
