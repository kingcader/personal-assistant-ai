/**
 * Business Context Database Queries
 *
 * Query functions for projects, SOPs, business rules, and decisions.
 * Part of Loop 9: Business Context + Agent Foundation
 */

import { supabase } from './client';

// Helper to bypass Supabase type checking for new tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// TYPES
// ============================================

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';
export type SopCategory = 'email' | 'scheduling' | 'follow_up' | 'research' | 'communication' | 'task_management' | 'other';
export type RuleType = 'constraint' | 'preference' | 'requirement';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  entity_id: string | null;
  key_contacts: string[];
  milestones: Array<{
    name: string;
    target_date?: string;
    completed_at?: string;
    notes?: string;
  }>;
  current_blockers: string[] | null;
  next_steps: string[] | null;
  started_at: string | null;
  target_completion: string | null;
  completed_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Sop {
  id: string;
  name: string;
  description: string | null;
  category: SopCategory;
  trigger_patterns: string[] | null;
  steps: Array<{
    step_number: number;
    instruction: string;
    examples?: string;
    notes?: string;
  }>;
  examples: Array<{
    input: string;
    expected_output: string;
    notes?: string;
  }>;
  is_active: boolean;
  priority: number;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: RuleType;
  condition: string;
  action: string;
  applies_to_projects: string[] | null;
  applies_to_entities: string[] | null;
  applies_to_categories: SopCategory[] | null;
  priority: number;
  is_active: boolean;
  times_applied: number;
  last_applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: string;
  decision: string;
  rationale: string | null;
  context: string | null;
  decided_at: string;
  project_id: string | null;
  related_entity_ids: string[] | null;
  related_task_ids: string[] | null;
  source: string;
  source_reference: string | null;
  supersedes_id: string | null;
  is_current: boolean;
  created_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  activity_type: string;
  description: string;
  source_type: string | null;
  source_id: string | null;
  entity_ids: string[] | null;
  occurred_at: string;
  created_at: string;
}

// ============================================
// PROJECT QUERIES
// ============================================

/**
 * Get all projects
 */
export async function getProjects(status?: ProjectStatus): Promise<Project[]> {
  let query = db.from('projects').select('*').order('updated_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[BusinessContext] Error fetching projects:', error);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return data as Project[];
}

/**
 * Get active projects (shorthand)
 */
export async function getActiveProjects(): Promise<Project[]> {
  return getProjects('active');
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[BusinessContext] Error fetching project:', error);
    throw new Error(`Failed to fetch project: ${error.message}`);
  }

  return data as Project | null;
}

/**
 * Get project by name (fuzzy match)
 */
export async function getProjectByName(name: string): Promise<Project | null> {
  // Try exact match first
  const { data: exactMatch } = await db
    .from('projects')
    .select('*')
    .ilike('name', name)
    .single();

  if (exactMatch) return exactMatch as Project;

  // Try partial match
  const { data: partialMatches } = await db
    .from('projects')
    .select('*')
    .ilike('name', `%${name}%`)
    .order('updated_at', { ascending: false })
    .limit(1);

  return partialMatches?.[0] as Project | null;
}

/**
 * Create a new project
 */
export async function createProject(project: {
  name: string;
  description?: string;
  status?: ProjectStatus;
  entity_id?: string;
  key_contacts?: string[];
  milestones?: Project['milestones'];
  current_blockers?: string[];
  next_steps?: string[];
  started_at?: string;
  target_completion?: string;
  metadata?: Record<string, any>;
}): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .insert({
      name: project.name,
      description: project.description || null,
      status: project.status || 'active',
      entity_id: project.entity_id || null,
      key_contacts: project.key_contacts || [],
      milestones: project.milestones || [],
      current_blockers: project.current_blockers || null,
      next_steps: project.next_steps || null,
      started_at: project.started_at || null,
      target_completion: project.target_completion || null,
      metadata: project.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[BusinessContext] Error creating project:', error);
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return data as Project;
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>
): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[BusinessContext] Error updating project:', error);
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return data as Project;
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await db.from('projects').delete().eq('id', id);

  if (error) {
    console.error('[BusinessContext] Error deleting project:', error);
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}

/**
 * Get project activity
 */
export async function getProjectActivity(projectId: string, limit = 20): Promise<ProjectActivity[]> {
  const { data, error } = await db
    .from('project_activity')
    .select('*')
    .eq('project_id', projectId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[BusinessContext] Error fetching project activity:', error);
    throw new Error(`Failed to fetch project activity: ${error.message}`);
  }

  return data as ProjectActivity[];
}

/**
 * Add project activity
 */
export async function addProjectActivity(activity: {
  project_id: string;
  activity_type: string;
  description: string;
  source_type?: string;
  source_id?: string;
  entity_ids?: string[];
  occurred_at?: string;
}): Promise<ProjectActivity> {
  const { data, error } = await db
    .from('project_activity')
    .insert({
      project_id: activity.project_id,
      activity_type: activity.activity_type,
      description: activity.description,
      source_type: activity.source_type || null,
      source_id: activity.source_id || null,
      entity_ids: activity.entity_ids || null,
      occurred_at: activity.occurred_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[BusinessContext] Error adding project activity:', error);
    throw new Error(`Failed to add project activity: ${error.message}`);
  }

  return data as ProjectActivity;
}

// ============================================
// SOP QUERIES
// ============================================

/**
 * Get all SOPs
 */
export async function getSops(category?: SopCategory, activeOnly = true): Promise<Sop[]> {
  let query = db.from('sops').select('*').order('priority', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[BusinessContext] Error fetching SOPs:', error);
    throw new Error(`Failed to fetch SOPs: ${error.message}`);
  }

  return data as Sop[];
}

/**
 * Get SOP by ID
 */
export async function getSopById(id: string): Promise<Sop | null> {
  const { data, error } = await db.from('sops').select('*').eq('id', id).single();

  if (error && error.code !== 'PGRST116') {
    console.error('[BusinessContext] Error fetching SOP:', error);
    throw new Error(`Failed to fetch SOP: ${error.message}`);
  }

  return data as Sop | null;
}

/**
 * Find SOPs by trigger pattern
 */
export async function findSopsByTrigger(text: string): Promise<Sop[]> {
  // Get all active SOPs and filter by trigger patterns
  const { data, error } = await db
    .from('sops')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('[BusinessContext] Error finding SOPs by trigger:', error);
    return [];
  }

  const sops = data as Sop[];
  const lowerText = text.toLowerCase();

  // Filter SOPs where any trigger pattern matches
  return sops.filter((sop) =>
    sop.trigger_patterns?.some((pattern) =>
      lowerText.includes(pattern.toLowerCase())
    )
  );
}

/**
 * Create a new SOP
 */
export async function createSop(sop: {
  name: string;
  description?: string;
  category: SopCategory;
  trigger_patterns?: string[];
  steps: Sop['steps'];
  examples?: Sop['examples'];
  priority?: number;
}): Promise<Sop> {
  const { data, error } = await db
    .from('sops')
    .insert({
      name: sop.name,
      description: sop.description || null,
      category: sop.category,
      trigger_patterns: sop.trigger_patterns || [],
      steps: sop.steps,
      examples: sop.examples || [],
      is_active: true,
      priority: sop.priority || 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[BusinessContext] Error creating SOP:', error);
    throw new Error(`Failed to create SOP: ${error.message}`);
  }

  return data as Sop;
}

/**
 * Update an SOP
 */
export async function updateSop(
  id: string,
  updates: Partial<Omit<Sop, 'id' | 'created_at' | 'updated_at' | 'times_used' | 'last_used_at'>>
): Promise<Sop> {
  const { data, error } = await db.from('sops').update(updates).eq('id', id).select().single();

  if (error) {
    console.error('[BusinessContext] Error updating SOP:', error);
    throw new Error(`Failed to update SOP: ${error.message}`);
  }

  return data as Sop;
}

/**
 * Delete an SOP
 */
export async function deleteSop(id: string): Promise<void> {
  const { error } = await db.from('sops').delete().eq('id', id);

  if (error) {
    console.error('[BusinessContext] Error deleting SOP:', error);
    throw new Error(`Failed to delete SOP: ${error.message}`);
  }
}

/**
 * Record SOP usage
 */
export async function recordSopUsage(id: string): Promise<void> {
  const { error } = await db
    .from('sops')
    .update({
      times_used: db.sql`times_used + 1`,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[BusinessContext] Error recording SOP usage:', error);
  }
}

// ============================================
// BUSINESS RULES QUERIES
// ============================================

/**
 * Get all business rules
 */
export async function getBusinessRules(activeOnly = true): Promise<BusinessRule[]> {
  let query = db.from('business_rules').select('*').order('priority', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[BusinessContext] Error fetching business rules:', error);
    throw new Error(`Failed to fetch business rules: ${error.message}`);
  }

  return data as BusinessRule[];
}

/**
 * Get business rule by ID
 */
export async function getBusinessRuleById(id: string): Promise<BusinessRule | null> {
  const { data, error } = await db.from('business_rules').select('*').eq('id', id).single();

  if (error && error.code !== 'PGRST116') {
    console.error('[BusinessContext] Error fetching business rule:', error);
    throw new Error(`Failed to fetch business rule: ${error.message}`);
  }

  return data as BusinessRule | null;
}

/**
 * Get applicable business rules for a context
 */
export async function getApplicableRules(params: {
  projectId?: string;
  entityId?: string;
  category?: SopCategory;
}): Promise<BusinessRule[]> {
  const allRules = await getBusinessRules(true);

  return allRules.filter((rule) => {
    // If rule has specific project scope, check if this project is included
    if (rule.applies_to_projects?.length && params.projectId) {
      if (!rule.applies_to_projects.includes(params.projectId)) {
        return false;
      }
    }

    // If rule has specific entity scope, check if this entity is included
    if (rule.applies_to_entities?.length && params.entityId) {
      if (!rule.applies_to_entities.includes(params.entityId)) {
        return false;
      }
    }

    // If rule has specific category scope, check if this category is included
    if (rule.applies_to_categories?.length && params.category) {
      if (!rule.applies_to_categories.includes(params.category)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Create a new business rule
 */
export async function createBusinessRule(rule: {
  name: string;
  description?: string;
  rule_type: RuleType;
  condition: string;
  action: string;
  applies_to_projects?: string[];
  applies_to_entities?: string[];
  applies_to_categories?: SopCategory[];
  priority?: number;
}): Promise<BusinessRule> {
  const { data, error } = await db
    .from('business_rules')
    .insert({
      name: rule.name,
      description: rule.description || null,
      rule_type: rule.rule_type,
      condition: rule.condition,
      action: rule.action,
      applies_to_projects: rule.applies_to_projects || null,
      applies_to_entities: rule.applies_to_entities || null,
      applies_to_categories: rule.applies_to_categories || null,
      priority: rule.priority || 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[BusinessContext] Error creating business rule:', error);
    throw new Error(`Failed to create business rule: ${error.message}`);
  }

  return data as BusinessRule;
}

/**
 * Update a business rule
 */
export async function updateBusinessRule(
  id: string,
  updates: Partial<Omit<BusinessRule, 'id' | 'created_at' | 'updated_at' | 'times_applied' | 'last_applied_at'>>
): Promise<BusinessRule> {
  const { data, error } = await db.from('business_rules').update(updates).eq('id', id).select().single();

  if (error) {
    console.error('[BusinessContext] Error updating business rule:', error);
    throw new Error(`Failed to update business rule: ${error.message}`);
  }

  return data as BusinessRule;
}

/**
 * Delete a business rule
 */
export async function deleteBusinessRule(id: string): Promise<void> {
  const { error } = await db.from('business_rules').delete().eq('id', id);

  if (error) {
    console.error('[BusinessContext] Error deleting business rule:', error);
    throw new Error(`Failed to delete business rule: ${error.message}`);
  }
}

// ============================================
// DECISION LOG QUERIES
// ============================================

/**
 * Get decisions
 */
export async function getDecisions(params?: {
  projectId?: string;
  currentOnly?: boolean;
  limit?: number;
}): Promise<Decision[]> {
  let query = db.from('decision_log').select('*').order('decided_at', { ascending: false });

  if (params?.projectId) {
    query = query.eq('project_id', params.projectId);
  }

  if (params?.currentOnly !== false) {
    query = query.eq('is_current', true);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[BusinessContext] Error fetching decisions:', error);
    throw new Error(`Failed to fetch decisions: ${error.message}`);
  }

  return data as Decision[];
}

/**
 * Get decision by ID
 */
export async function getDecisionById(id: string): Promise<Decision | null> {
  const { data, error } = await db.from('decision_log').select('*').eq('id', id).single();

  if (error && error.code !== 'PGRST116') {
    console.error('[BusinessContext] Error fetching decision:', error);
    throw new Error(`Failed to fetch decision: ${error.message}`);
  }

  return data as Decision | null;
}

/**
 * Log a new decision
 */
export async function logDecision(decision: {
  decision: string;
  rationale?: string;
  context?: string;
  decided_at?: string;
  project_id?: string;
  related_entity_ids?: string[];
  related_task_ids?: string[];
  source?: string;
  source_reference?: string;
  supersedes_id?: string;
}): Promise<Decision> {
  // If this supersedes another decision, mark the old one as not current
  if (decision.supersedes_id) {
    await db
      .from('decision_log')
      .update({ is_current: false })
      .eq('id', decision.supersedes_id);
  }

  const { data, error } = await db
    .from('decision_log')
    .insert({
      decision: decision.decision,
      rationale: decision.rationale || null,
      context: decision.context || null,
      decided_at: decision.decided_at || new Date().toISOString(),
      project_id: decision.project_id || null,
      related_entity_ids: decision.related_entity_ids || null,
      related_task_ids: decision.related_task_ids || null,
      source: decision.source || 'manual',
      source_reference: decision.source_reference || null,
      supersedes_id: decision.supersedes_id || null,
      is_current: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[BusinessContext] Error logging decision:', error);
    throw new Error(`Failed to log decision: ${error.message}`);
  }

  return data as Decision;
}

/**
 * Search decisions
 */
export async function searchDecisions(query: string, limit = 10): Promise<Decision[]> {
  const { data, error } = await db
    .from('decision_log')
    .select('*')
    .eq('is_current', true)
    .or(`decision.ilike.%${query}%,rationale.ilike.%${query}%,context.ilike.%${query}%`)
    .order('decided_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[BusinessContext] Error searching decisions:', error);
    return [];
  }

  return data as Decision[];
}

// ============================================
// COMBINED CONTEXT QUERIES
// ============================================

/**
 * Get full business context for agent use
 * Returns all active projects, SOPs, rules, and recent decisions
 */
export async function getFullBusinessContext(): Promise<{
  projects: Project[];
  sops: Sop[];
  rules: BusinessRule[];
  recentDecisions: Decision[];
}> {
  const [projects, sops, rules, recentDecisions] = await Promise.all([
    getActiveProjects(),
    getSops(),
    getBusinessRules(),
    getDecisions({ limit: 20 }),
  ]);

  return { projects, sops, rules, recentDecisions };
}

/**
 * Get context for a specific project
 */
export async function getProjectContext(projectId: string): Promise<{
  project: Project | null;
  activity: ProjectActivity[];
  decisions: Decision[];
  applicableRules: BusinessRule[];
}> {
  const project = await getProjectById(projectId);

  if (!project) {
    return { project: null, activity: [], decisions: [], applicableRules: [] };
  }

  const [activity, decisions, applicableRules] = await Promise.all([
    getProjectActivity(projectId),
    getDecisions({ projectId }),
    getApplicableRules({ projectId }),
  ]);

  return { project, activity, decisions, applicableRules };
}
